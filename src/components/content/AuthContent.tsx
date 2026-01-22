import { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";
import { SettingInput } from "@/components/ui/setting-input";

const AuthContent = () => {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex-1 flex items-center justify-center bg-surface p-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src="/Qonsol-Full-Logo_Transparent_NoBuffer.png" 
            alt="Qonsol" 
            className="h-8 opacity-90"
          />
        </div>

        {/* Card */}
        <div className="bg-surface-container-low rounded-m3-lg p-6 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-surface-container rounded-m3-md">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-body-sm font-medium rounded-m3-sm transition-colors ${
                mode === "login"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-on-surface/[0.08]"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-body-sm font-medium rounded-m3-sm transition-colors ${
                mode === "signup"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-on-surface/[0.08]"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full h-10 pl-10 pr-3 bg-surface-container rounded-m3-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-label-sm text-on-surface-variant">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full h-10 pl-10 pr-3 bg-surface-container rounded-m3-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-on-surface-variant">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-10 pl-10 pr-10 bg-surface-container rounded-m3-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full h-10 pl-10 pr-3 bg-surface-container rounded-m3-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="flex justify-end">
                <button className="text-tree text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button className="w-full h-10 bg-primary text-on-primary rounded-m3-sm text-body-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
            {mode === "login" ? "Sign In" : "Create Account"}
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-compact text-on-surface-variant uppercase">or continue with</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          {/* Social Login */}
          <div className="flex gap-3">
            <button className="flex-1 h-10 bg-surface-container rounded-m3-sm text-body-sm text-on-surface font-medium flex items-center justify-center gap-2 hover:bg-on-surface/[0.08] transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button className="flex-1 h-10 bg-surface-container rounded-m3-sm text-body-sm text-on-surface font-medium flex items-center justify-center gap-2 hover:bg-on-surface/[0.08] transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-tree text-on-surface-variant">
          By continuing, you agree to our{" "}
          <button className="text-primary hover:underline">Terms of Service</button>
          {" "}and{" "}
          <button className="text-primary hover:underline">Privacy Policy</button>
        </p>
      </div>
    </div>
  );
};

export default AuthContent;