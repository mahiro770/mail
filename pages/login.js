import { useState } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
 // ログイン処理
  const handleLogin = async () => {
    if (loading) return;
    setErrorMessage("");

    if (!email) {
      setErrorMessage("メールアドレスを入力してください");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
        credentials: "include",
      });

  let result = null;

if (res.headers.get("content-type")?.includes("application/json")) {
  result = await res.json().catch(() => null);
}

if (!res.ok) {
  setErrorMessage(result?.error ?? "ログインに失敗しました");
return;
}
      
      router.push("/");
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error ? error.message : "ログインに失敗しました";

      setErrorMessage(message);
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

        {errorMessage && <div style={styles.error}>{errorMessage}</div>}

        <button
          onClick={handleLogin}
          disabled={loading || !email}
          style={{
            ...styles.button,
            opacity: loading || !email ? 0.7 : 1,
            cursor: loading || !email ? "not-allowed" : "pointer",
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
