import { supabase, API_CONFIG } from '/js/config.js';

const UserService = {
  async getMe() {
    try {
      // Get current session to provide token for backend
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.endpoints.usersMe}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch /users/me');
      }

      return await res.json();
    } catch (err) {
      console.warn('Could not fetch user info:', err);
      return null;
    }
  }
};

export { UserService };
