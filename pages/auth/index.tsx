import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/router'

export default function AuthPage() {    
    const supabase = useSupabaseClient()

    const user = useUser()

    const router = useRouter()

    if (user) {
        router.push("/")
    }

    
    return (
        <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
        />
    )
}
