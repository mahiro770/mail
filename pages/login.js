import { useState } from "react";
import { login } from "../lib/admin";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    setErrorMessage("");

    if (!email) {
      setErrorMessage("メールアドレスを入力してください");
      return;
    }

    try {
      setLoading(true);

      await login(email);

      // ログイン成功後にトップへ移動
      window.location.href = "/";
    } catch (error) {
      console.error(error);

      setErrorMessage("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>案件配信メール　ログイン画面</h1>

        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        {errorMessage && (
          <div style={styles.error}>
            {errorMessage}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f7fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  title: {
    margin: 0,
    textAlign: "center",
    color: "#1a365d",
  },

  input: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #cbd5e0",
    fontSize: "1rem",
  },

  button: {
    padding: 12,
    borderRadius: 8,
    border: "none",
    backgroundColor: "#1a365d",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "1rem",
  },

  error: {
    color: "#e53e3e",
    fontSize: "0.9rem",
  },
};

