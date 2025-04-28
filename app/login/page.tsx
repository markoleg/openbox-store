import LoginForm from '@/components/LoginForm/LoginForm';
import styles from '@/components/LoginForm/LoginForm.module.css';
export default function LoginPage() {
  return (
    <div className={styles.loginPage}>
      <h1>Welcome, ZheZhe!</h1>
      <LoginForm />
    </div>
  );
}