'use client'
import React, { useState, FormEvent } from 'react';
import styles from '@/components/LoginForm/LoginForm.module.css';

interface LoginFormProps {
}

const LoginForm: React.FC<LoginFormProps> = ({ }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

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
                window.location.href = '/';
            } else {
                const data = await response.json();
                setError(data.error || 'Login failed');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        }
    };
    return (
        <div className={styles.loginForm}>
            <form onSubmit={handleSubmit}>
                <div><label htmlFor="password">Password:</label><input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
                {error && <p style={{ color: 'red' }}>Вийди отсюда, розбійник!</p>}
                {/* {error && <p style={{ color: 'red' }}>{error}</p>} */}
                <button type="submit">Submit</button>
            </form>
        </div>
    );
};

export default LoginForm