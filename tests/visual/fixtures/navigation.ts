export const usePathname = () => '/'
export const useRouter = () => ({ refresh() {} })
export const useAuth = () => ({ isLoaded: true, isSignedIn: false })
export const useClerk = () => ({ signOut: async () => {} })
export const setLanguagePreference = async () => ({ ok: true })
