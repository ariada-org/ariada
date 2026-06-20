// Fixture source file — used by tests as the "source file content" returned by GitHub API mock.
// Contains 3 simulated color-contrast violations at lines 14–16.
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

// Component with accessibility issues for testing fix-PR generation
export function Button({ label, onClick }: ButtonProps) {
  return (
    <button
      style={{ color: '#aaa', background: '#fff', border: 'none' }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
