import { supabase } from "./supabaseClient";
import { logSecurityEvent } from "./securityUtils";

/**
 * Enhanced authentication utilities with security features
 */

// Login with phone and password
export const loginWithPhone = async (phone: string, password: string) => {
  try {
    // Validate inputs
    if (!phone || !password) {
      return { user: null, error: "Phone and password are required" };
    }

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      phone,
      password,
    });

    if (error) {
      // Log failed login attempt
      await supabase.functions.invoke("supabase-functions-audit-login", {
        body: {
          userId: null,
          eventType: "failed_login_attempt",
          details: {
            phone,
            reason: error.message,
            timestamp: new Date().toISOString(),
          },
        },
      });

      throw error;
    }

    // Log successful login
    if (data.user) {
      await supabase.functions.invoke("supabase-functions-audit-login", {
        body: {
          userId: data.user.id,
          eventType: "successful_login",
          details: { timestamp: new Date().toISOString() },
        },
      });

      // Also log locally
      logSecurityEvent(data.user.id, "login_successful", {
        timestamp: new Date().toISOString(),
      });
    }

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error("Login error:", error);
    return { user: null, session: null, error };
  }
};

// Sign out
export const signOut = async () => {
  try {
    // Get current user before signing out
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    // Sign out
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Log sign out event if we had a user
    if (userId) {
      await supabase.functions
        .invoke("supabase-functions-audit-login", {
          body: {
            userId,
            eventType: "sign_out",
            details: { timestamp: new Date().toISOString() },
          },
        })
        .catch((err) => console.error("Error logging sign out:", err));
    }

    return { error: null };
  } catch (error) {
    console.error("Sign out error:", error);
    return { error };
  }
};

// Change password with security checks
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
) => {
  try {
    // Validate password strength
    if (newPassword.length < 8) {
      return { error: "Password must be at least 8 characters long" };
    }

    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return {
        error: "Password must contain uppercase, lowercase, and numbers",
      };
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Verify current password by attempting a login
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email || "",
      phone: user.phone || "",
      password: currentPassword,
    });

    if (verifyError) {
      // Log failed password change attempt
      await supabase.functions.invoke("supabase-functions-audit-login", {
        body: {
          userId: user.id,
          eventType: "failed_password_change",
          details: {
            reason: "Current password verification failed",
            timestamp: new Date().toISOString(),
          },
        },
      });

      return { error: "Current password is incorrect" };
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    // Log successful password change
    await supabase.functions.invoke("supabase-functions-audit-login", {
      body: {
        userId: user.id,
        eventType: "password_changed",
        details: { timestamp: new Date().toISOString() },
      },
    });

    return { error: null };
  } catch (error) {
    console.error("Change password error:", error);
    return { error };
  }
};

// Request password reset with phone
export const requestPasswordResetWithPhone = async (phone: string) => {
  try {
    // Validate phone
    if (!phone) {
      return { error: "Phone number is required" };
    }

    // Request OTP
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) throw error;

    // Log password reset request
    await supabase.functions
      .invoke("supabase-functions-audit-login", {
        body: {
          userId: null,
          eventType: "password_reset_requested",
          details: { phone, timestamp: new Date().toISOString() },
        },
      })
      .catch((err) =>
        console.error("Error logging password reset request:", err),
      );

    return { error: null };
  } catch (error) {
    console.error("Password reset request error:", error);
    return { error };
  }
};

// Verify OTP and reset password
export const verifyOtpAndResetPassword = async (
  phone: string,
  otp: string,
  newPassword: string,
) => {
  try {
    // Validate inputs
    if (!phone || !otp || !newPassword) {
      return { error: "Phone, OTP, and new password are required" };
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return { error: "Password must be at least 8 characters long" };
    }

    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return {
        error: "Password must contain uppercase, lowercase, and numbers",
      };
    }

    // Verify OTP
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) throw error;

    // If OTP verification successful, update password
    if (data.user) {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Log successful password reset
      await supabase.functions.invoke("supabase-functions-audit-login", {
        body: {
          userId: data.user.id,
          eventType: "password_reset_successful",
          details: { timestamp: new Date().toISOString() },
        },
      });

      return { user: data.user, error: null };
    }

    return { user: null, error: "OTP verification failed" };
  } catch (error) {
    console.error("OTP verification error:", error);
    return { user: null, error };
  }
};
