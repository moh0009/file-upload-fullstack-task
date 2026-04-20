package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type JobStatus string

const (
	JobPending    JobStatus = "pending"
	JobProcessing JobStatus = "processing"
	JobCompleted  JobStatus = "completed"
	JobFailed     JobStatus = "failed"
)

type ProcessJob struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	FileName    string     `json:"file_name"`
	FileSize    int64      `json:"file_size"`
	Status      JobStatus  `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	WorkerID    string     `json:"worker_id,omitempty"`
	RetryCount  int        `json:"retry_count"`
	MaxRetries  int        `json:"max_retries"`
	Error       string     `json:"error,omitempty"`
}

type RedisQueue struct {
	client       *redis.Client
	queueKey     string
	jobsKey      string
	workerKey    string
	heartbeatTTL time.Duration
	maxRetries   int
}

func NewRedisQueue(rdb *redis.Client, maxRetries int) *RedisQueue {
	return &RedisQueue{
		client:       rdb,
		queueKey:     "csv:queue:priority",
		jobsKey:      "csv:jobs",
		workerKey:    "csv:workers",
		heartbeatTTL: 30 * time.Second,
		maxRetries:   maxRetries,
	}
}

func (q *RedisQueue) Enqueue(ctx context.Context, job *ProcessJob) error {
	// Only generate ID if not already set (use fileId from frontend if available)
	if job.ID == "" {
		job.ID = uuid.New().String()
	}
	job.Status = JobPending
	job.CreatedAt = time.Now()
	job.MaxRetries = q.maxRetries

	jobData, err := json.Marshal(job)
	if err != nil {
		return err
	}

	// Score: older jobs = higher score (lower timestamp diff)
	score := float64(time.Now().UnixNano() - job.CreatedAt.UnixNano())

	pipe := q.client.Pipeline()
	pipe.HSet(ctx, q.jobsKey, job.ID, jobData)
	pipe.ZAdd(ctx, q.queueKey, redis.Z{Score: score, Member: job.ID})
	pipe.Expire(ctx, q.jobsKey, 7*24*time.Hour)
	_, err = pipe.Exec(ctx)
	return err
}

func (q *RedisQueue) Dequeue(ctx context.Context, workerID string) (*ProcessJob, error) {
	result, err := q.client.BZPopMax(ctx, 10*time.Second, q.queueKey).Result()
	if err != nil || result == nil {
		return nil, err
	}

	jobID := result.Member.(string)
	jobData, err := q.client.HGet(ctx, q.jobsKey, jobID).Result()
	if err != nil {
		return nil, err
	}

	var job ProcessJob
	if err := json.Unmarshal([]byte(jobData), &job); err != nil {
		return nil, err
	}

	// Claim job
	now := time.Now()
	job.Status = JobProcessing
	job.StartedAt = &now
	job.WorkerID = workerID
	job.RetryCount++

	newJobData, _ := json.Marshal(job)
	pipe := q.client.Pipeline()
	pipe.HSet(ctx, q.jobsKey, jobID, newJobData)
	pipe.HSet(ctx, q.workerKey, workerID, time.Now().Unix())
	pipe.Expire(ctx, q.workerKey, 2*q.heartbeatTTL)
	_, _ = pipe.Exec(ctx)

	return &job, nil
}

func (q *RedisQueue) UpdateStatus(ctx context.Context, jobID string, status JobStatus, errMsg string) error {
	jobData, err := q.client.HGet(ctx, q.jobsKey, jobID).Result()
	if err != nil {
		return err
	}

	var job ProcessJob
	json.Unmarshal([]byte(jobData), &job)

	now := time.Now()
	job.Status = status
	if status == JobCompleted || status == JobFailed {
		job.CompletedAt = &now
	}
	if errMsg != "" {
		job.Error = errMsg
	}

	// Retry logic for failed jobs
	if status == JobFailed && job.RetryCount < job.MaxRetries && isRecoverable(errMsg) {
		job.Status = JobPending
		job.WorkerID = ""
		job.StartedAt = nil
		job.Error = fmt.Sprintf("retry %d: %s", job.RetryCount, errMsg)

		newJobData, _ := json.Marshal(job)
		score := float64(time.Now().UnixNano())

		pipe := q.client.Pipeline()
		pipe.HSet(ctx, q.jobsKey, jobID, newJobData)
		pipe.ZAdd(ctx, q.queueKey, redis.Z{Score: score, Member: jobID})
		_, _ = pipe.Exec(ctx)
		return nil
	}

	newJobData, _ := json.Marshal(job)
	pipe := q.client.Pipeline()
	pipe.HSet(ctx, q.jobsKey, jobID, newJobData)
	_, _ = pipe.Exec(ctx)
	return nil
}

func (q *RedisQueue) Heartbeat(ctx context.Context, workerID string) error {
	pipe := q.client.Pipeline()
	pipe.HSet(ctx, q.workerKey, workerID, time.Now().Unix())
	pipe.Expire(ctx, q.workerKey, 2*q.heartbeatTTL)
	_, err := pipe.Exec(ctx)
	return err
}

func (q *RedisQueue) RecoverStaleJobs(ctx context.Context) ([]string, error) {
	now := time.Now().Unix()
	timeout := now - int64(q.heartbeatTTL.Seconds()*2)
	workers, _ := q.client.HGetAll(ctx, q.workerKey).Result()

	var recovered []string
	for wid, beatStr := range workers {
		var beat int64
		fmt.Sscanf(beatStr, "%d", &beat)
		if beat < timeout {
			// Find jobs assigned to dead worker
			jobs, _ := q.client.HGetAll(ctx, q.jobsKey).Result()
			for jid, jdata := range jobs {
				var job ProcessJob
				if json.Unmarshal([]byte(jdata), &job) == nil && job.WorkerID == wid && job.Status == JobProcessing {
					job.Status = JobPending
					job.WorkerID = ""
					job.StartedAt = nil
					job.Error = fmt.Sprintf("recovered from crashed worker %s", wid)
					newJData, _ := json.Marshal(job)

					score := float64(time.Now().UnixNano())
					pipe := q.client.Pipeline()
					pipe.HSet(ctx, q.jobsKey, jid, newJData)
					pipe.ZAdd(ctx, q.queueKey, redis.Z{Score: score, Member: jid})
					pipe.HDel(ctx, q.workerKey, wid)
					_, _ = pipe.Exec(ctx)
					recovered = append(recovered, jid)
				}
			}
		}
	}
	return recovered, nil
}

func (q *RedisQueue) GetJob(ctx context.Context, jobID string) (*ProcessJob, error) {
	data, err := q.client.HGet(ctx, q.jobsKey, jobID).Result()
	if err != nil {
		return nil, err
	}
	var job ProcessJob
	err = json.Unmarshal([]byte(data), &job)
	return &job, err
}

func isRecoverable(err string) bool {
	kw := []string{"timeout", "connection", "lock", "deadlock", "context deadline"}
	for _, k := range kw {
		if strings.Contains(strings.ToLower(err), k) {
			return true
		}
	}
	return false
}

