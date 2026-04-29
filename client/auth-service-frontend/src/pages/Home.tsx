import { useAuth } from "@/state/auth/AuthContext";
import "../App.css";

export function Home() {
  const { accessToken } = useAuth();
  return (
    <>
      <div className="text-red-500">ttettt</div>
    </>
  );
}
