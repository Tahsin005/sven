import { useEffect, useState } from "react";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useNavigate } from "react-router";


const supabase = createClient();

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        async function getInfo() {
            const {data, error} = await supabase.auth.getUser();

            if (error) {
                alert("Error fetching user info" + error.message);
                return;
            }

            if (data.user) {
                setUser(data.user);
            }
        }

        getInfo();

    }, []);

    return (
        <div className="flex flex-col justify-center items-center h-screen space-y-3">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {!user && <button onClick={() => navigate("/auth")} className="p-2 border border-black rounded-lg">Login</button>}
            {user && (
                <div className="flex flex-col justify-center items-center space-y-3">
                    <p>Welcome, {user.email}</p>
                    <button onClick={async () => {
                        await supabase.auth.signOut();
                        setUser(null);
                        navigate("/");
                    }} className="p-2 border border-black rounded-lg">Logout</button>
                </div>
            )}
        </div>
    )
}