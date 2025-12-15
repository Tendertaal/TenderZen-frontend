# Backend/app/services/password_service.py
# Password History Service voor TenderZen
# 
# Dit bestand bevat de logica voor het checken en opslaan van wachtwoord history.
# Alleen OUDE wachtwoorden worden opgeslagen, nooit het huidige/nieuwe wachtwoord.

import bcrypt
from typing import Optional, Tuple
from ..core.database import get_supabase


class PasswordService:
    """
    Service voor wachtwoord history management.
    
    Flow bij wachtwoord wijziging:
    1. Check of nieuw wachtwoord != huidig wachtwoord
    2. Check of nieuw wachtwoord niet in history staat
    3. Als OK: kopieer HUIDIG wachtwoord naar history (wordt dan "oud")
    4. Frontend wijzigt wachtwoord via Supabase Auth
    """
    
    def __init__(self):
        self.supabase = get_supabase()
    
    async def get_current_password_hash(self, user_id: str) -> Optional[str]:
        """
        Haal de huidige wachtwoord hash op uit auth.users.
        Vereist service_role key.
        """
        try:
            result = self.supabase.rpc(
                "get_current_password_hash", 
                {"p_user_id": user_id}
            ).execute()
            
            if result.data:
                return result.data
            return None
        except Exception as e:
            print(f"❌ Error fetching current password hash: {e}")
            return None
    
    async def get_password_history(self, user_id: str) -> list:
        """
        Haal de wachtwoord history op (laatste 5 oude wachtwoorden).
        """
        try:
            result = self.supabase.rpc(
                "get_password_history",
                {"p_user_id": user_id}
            ).execute()
            
            return result.data or []
        except Exception as e:
            print(f"❌ Error fetching password history: {e}")
            return []
    
    async def add_old_password_to_history(self, user_id: str, old_password_hash: str) -> bool:
        """
        Voeg het OUDE wachtwoord toe aan history.
        Dit wordt aangeroepen VOORDAT het wachtwoord wordt gewijzigd.
        """
        try:
            self.supabase.rpc(
                "add_old_password_to_history",
                {
                    "p_user_id": user_id,
                    "p_old_password_hash": old_password_hash
                }
            ).execute()
            
            print(f"✅ Old password saved to history for user {user_id}")
            return True
        except Exception as e:
            print(f"❌ Error saving password to history: {e}")
            return False
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Vergelijk een plain-text wachtwoord met een bcrypt hash.
        """
        try:
            # Supabase/GoTrue gebruikt bcrypt
            return bcrypt.checkpw(
                plain_password.encode('utf-8'),
                hashed_password.encode('utf-8')
            )
        except Exception as e:
            print(f"❌ Error verifying password: {e}")
            return False
    
    async def validate_and_prepare(self, user_id: str, new_password: str) -> Tuple[bool, str]:
        """
        Valideer nieuw wachtwoord en bereid wijziging voor.
        
        Returns:
            Tuple[bool, str]: (is_allowed, message)
        
        Flow:
        1. Check of nieuw wachtwoord != huidig wachtwoord
        2. Check of nieuw wachtwoord niet in history staat
        3. Als OK: kopieer HUIDIG wachtwoord naar history
        """
        
        # --- STAP 1: Haal huidig wachtwoord hash op ---
        current_hash = await self.get_current_password_hash(user_id)
        
        # --- STAP 2: Check of nieuw != huidig ---
        if current_hash:
            if self.verify_password(new_password, current_hash):
                return (False, "Nieuw wachtwoord mag niet hetzelfde zijn als je huidige wachtwoord.")
        
        # --- STAP 3: Check of nieuw niet in history staat ---
        history = await self.get_password_history(user_id)
        
        for entry in history:
            password_hash = entry.get('password_hash')
            if password_hash and self.verify_password(new_password, password_hash):
                return (False, "Dit wachtwoord is eerder gebruikt. Kies een ander wachtwoord.")
        
        # --- STAP 4: Alles OK - Kopieer HUIDIG naar history ---
        if current_hash:
            await self.add_old_password_to_history(user_id, current_hash)
        
        return (True, "Wachtwoord gevalideerd. Je kunt nu wijzigen.")


# Singleton instance
password_service = PasswordService()