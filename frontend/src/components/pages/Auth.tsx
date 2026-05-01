import { createClient } from '@/lib/supabase/client'
const supabase = createClient();


export default function Auth() {
    async function login(provider: "google" | "github") {
        const { data, error } =await supabase.auth.signInWithOAuth({
            provider,
        });
    }

    return (
        <div className='flex flex-col justify-center items-center h-screen space-y-3'>
            <button onClick={() => login("google")} className="p-2 border border-black rounded-lg">Google</button>
            <button onClick={() => login("github")} className="p-2 border border-black rounded-lg">Github</button>
        </div>
    )
}

