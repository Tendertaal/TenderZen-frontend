"""
Test script to validate TenderPlanner configuration
Run this to verify your .env file is set up correctly
"""

import sys
from pathlib import Path

def test_config():
    """Test configuration loading and validation"""
    print("🔧 Testing TenderPlanner Configuration")
    print("=" * 60)
    
    try:
        # Import settings
        from app.config import settings
        
        print("✅ Config module imported successfully")
        print()
        
        # Display configuration
        print("📋 Configuration Values:")
        print("-" * 60)
        print(f"Environment:        {settings.environment}")
        print(f"Port:              {settings.port}")
        print(f"Frontend URL:      {settings.frontend_url}")
        print(f"Supabase URL:      {settings.supabase_url}")
        print(f"JWT Algorithm:     {settings.jwt_algorithm}")
        print(f"JWT Expires (days): {settings.jwt_expires_in_days}")
        print()
        
        # Feature flags
        print("🎯 Feature Flags:")
        print("-" * 60)
        print(f"AI Enabled:        {settings.ai_enabled}")
        print(f"Email Enabled:     {settings.email_enabled}")
        print(f"Development Mode:  {settings.is_development}")
        print(f"Production Mode:   {settings.is_production}")
        print()
        
        # Rate limiting
        print("⏱️  Rate Limiting:")
        print("-" * 60)
        print(f"Window:            {settings.rate_limit_window_minutes} minutes")
        print(f"Max Requests:      {settings.rate_limit_max_requests}")
        print()
        
        # Validation checks
        print("🔍 Validation Checks:")
        print("-" * 60)
        
        checks = {
            "Supabase URL set": bool(settings.supabase_url),
            "Supabase URL valid": settings.supabase_url.startswith("https://"),
            "Service Role Key set": bool(settings.supabase_service_role_key),
            "Anon Key set": bool(settings.supabase_anon_key),
            "JWT Secret set": bool(settings.jwt_secret),
            "Port valid": 1 <= settings.port <= 65535,
        }
        
        all_passed = True
        for check, passed in checks.items():
            status = "✅" if passed else "❌"
            print(f"{status} {check}")
            if not passed:
                all_passed = False
        
        print()
        print("=" * 60)
        
        if all_passed:
            print("✅ All validation checks passed!")
            print("🚀 Configuration is ready to use!")
            return 0
        else:
            print("⚠️  Some validation checks failed.")
            print("Please check your .env file and update the values.")
            return 1
            
    except Exception as e:
        print(f"❌ Error loading configuration: {e}")
        print()
        print("Troubleshooting:")
        print("1. Make sure .env file exists in the project root")
        print("2. Check that all required variables are set")
        print("3. Verify your .env file syntax (KEY=value, no spaces)")
        return 1


if __name__ == "__main__":
    sys.exit(test_config())
