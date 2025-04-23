'use client'
import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface LoginFormProps {
}

const LoginForm: React.FC<LoginFormProps> = ({}) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (response.ok) {
                router.push('/');
            } else {
                const data = await response.json();
                setError(data.error || 'Login failed');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        }
    };
    return <div>
        <form onSubmit={handleSubmit}>
            <div><label htmlFor="password">Password:</label><input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <button type="submit">Submit</button>
        </form>
    </div>
};

export default LoginForm