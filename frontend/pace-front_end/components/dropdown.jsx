import React from 'react'
import Select from 'react-select'

const options = ['All Subjects', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'English Literature', 'Computer Science', 'Art', 'Music', 'Geography']

const Dropdown = () => (
    <div className="w-full sm:w-[250px]">
        <Select
            options={options.map(option => ({ value: option, label: option }))}
            placeholder="All Subjects"
            styles={{
                control: (base, state) => ({
                    ...base,
                    backgroundColor: 'white',
                    borderColor: state.isFocused ? '#6366f1' : '#e2e8f0',
                    borderRadius: '0.75rem',
                    minHeight: '44px',
                    boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
                    '&:hover': {
                        borderColor: state.isFocused ? '#6366f1' : '#cbd5e1'
                    }
                }),
                menu: (base) => ({
                    ...base,
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    overflow: 'hidden',
                    zIndex: 50
                }),
                option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected
                        ? '#4f46e5'
                        : state.isFocused
                            ? '#f8fafc'
                            : 'white',
                    color: state.isSelected ? 'white' : '#334155',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    padding: '10px 16px',
                    '&:active': {
                        backgroundColor: state.isSelected ? '#4f46e5' : '#f1f5f9',
                    }
                }),
                singleValue: (base) => ({
                    ...base,
                    color: '#0f172a',
                    fontSize: '0.875rem',
                }),
                placeholder: (base) => ({
                    ...base,
                    color: '#94a3b8',
                    fontSize: '0.875rem',
                }),
                indicatorSeparator: () => ({
                    display: 'none',
                }),
                dropdownIndicator: (base) => ({
                    ...base,
                    color: '#94a3b8',
                    '&:hover': {
                        color: '#64748b'
                    }
                })
            }}
        />
    </div>
)

export default Dropdown