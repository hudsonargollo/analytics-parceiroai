import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render the app title', () => {
    render(<App />);
    expect(screen.getByText('Subscription Recovery Analytics')).toBeInTheDocument();
  });

  it('should render the dashboard components', () => {
    render(<App />);
    expect(screen.getByText('Days Sales Outstanding (DSO)')).toBeInTheDocument();
  });
});
