import React from 'react'
import Select from 'react-select'

const Dropdown = ({ options, value, onChange, placeholder, className, menuPlacement = "auto" }) => (
    <div className={className || "w-full sm:w-[250px]"}>
        <Select
            options={options}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            menuPlacement={menuPlacement}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                control: (base, state) => ({
                    ...base,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderColor: state.isFocused ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '1rem',
                    minHeight: '48px',
                    width : "100%",
                    boxShadow: state.isFocused ? '0 0 0 4px rgba(99, 102, 241, 0.1)' : 'none',
                    '&:hover': {
                        borderColor: 'rgba(99, 102, 241, 0.5)'
                    }
                }),
                menu: (base) => ({
                    ...base,
                    backgroundColor: '#030712',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                    overflow: 'hidden',
                    zIndex: 50
                }),
                option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected
                        ? '#4f46e5'
                        : state.isFocused
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'transparent',
                    color: state.isSelected ? 'white' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    padding: '12px 16px',
                    '&:active': {
                        backgroundColor: '#4f46e5',
                    }
                }),
                singleValue: (base) => ({
                    ...base,
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                }),
                placeholder: (base) => ({
                    ...base,
                    color: '#4b5563',
                    fontSize: '0.875rem',
                }),
                indicatorSeparator: () => ({
                    display: 'none',
                }),
                dropdownIndicator: (base) => ({
                    ...base,
                    color: '#4b5563',
                    '&:hover': {
                        color: '#6366f1'
                    }
                })
            }}
        />
    </div>
)

export default Dropdown;