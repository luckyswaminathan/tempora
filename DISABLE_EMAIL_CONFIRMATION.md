# How to Disable Email Confirmation in Supabase

If you want users to be able to sign in immediately without confirming their email (useful for development/testing), follow these steps:

## Steps to Disable Email Confirmation

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard/project/oyzbtlhgeqqhlmalxdvm

2. **Navigate to Authentication Settings**
   - Click on **"Authentication"** in the left sidebar
   - Click on **"Settings"** tab

3. **Disable Email Confirmation**
   - Scroll down to **"Email Auth"** section
   - Find **"Enable email confirmations"** toggle
   - **Turn it OFF** (toggle to disabled/gray)

4. **Save Changes**
   - The changes are saved automatically

## After Disabling

- Users can sign up and immediately sign in without email confirmation
- No confirmation emails will be sent
- Sign-up will create a user account and automatically sign them in

## Security Note

⚠️ **For Production**: Email confirmation is a security best practice. Only disable it in:
- Development environments
- Testing environments
- If you're using other authentication methods (e.g., magic links, OAuth)

## Current Behavior

- **Email confirmation ENABLED**: User signs up → Gets email → Must click link → Then can sign in
- **Email confirmation DISABLED**: User signs up → Immediately signed in → Can use app right away

