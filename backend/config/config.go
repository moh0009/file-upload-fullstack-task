package config

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Config struct {
	DatabaseURL     string
	RedisAddr       string
	RedisPassword   string
	ServerPort      string
	UploadsDir      string
	MaxFileSize     int64
	ChunkSize       int64
	WorkerCount     int
	QueueMaxRetries int
	HeartbeatTTL    time.Duration
}

func Load() *Config {
	cfg := &Config{
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://root:toor@localhost:5432/pace_db?pool_max_conns=40&pool_min_conns=10&statement_timeout=30000"),
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:   getEnv("REDIS_PASSWORD", ""),
		ServerPort:      getEnv("SERVER_PORT", "8080"),
		UploadsDir:      getEnv("UPLOADS_DIR", "./uploads"),
		MaxFileSize:     getEnvInt64("MAX_FILE_SIZE", 100*1024*1024), // 100MB
		ChunkSize:       getEnvInt64("CHUNK_SIZE", 5*1024*1024),      // 5MB
		WorkerCount:     getEnvInt("WORKER_COUNT", 8),
		QueueMaxRetries: getEnvInt("QUEUE_MAX_RETRIES", 3),
		HeartbeatTTL:    getEnvDuration("HEARTBEAT_TTL", 30*time.Second),
	}
	return cfg
}

func (c *Config) InitDatabase() *pgxpool.Pool {
	dbpool, err := pgxpool.New(context.Background(), c.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection error: %v", err)
	}
	return dbpool
}

func (c *Config) InitRedis() *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:         c.RedisAddr,
		Password:     c.RedisPassword,
		DB:           0,
		PoolSize:     20,
		MinIdleConns: 5,
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Redis connection error: %v", err)
	}
	return rdb
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
