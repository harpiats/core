import type { Request } from "./request";
import type { Response } from "./response";
import type { SecurityHeaders } from "./types/shield";

export type { SecurityHeaders } from "./types/shield";

export class Shield {
  private headers: SecurityHeaders;
  private nonceStore: Map<string, string>;
  private trustProxy: boolean;
  private maxNoncesKeys: number;

  constructor(options: SecurityHeaders = {}) {
    this.nonceStore = new Map<string, string>();
    this.headers = {};
    this.trustProxy = options.trustProxy ?? false;
    this.maxNoncesKeys = options.maxNoncesKeys ?? 5000;

    this.setupHeaders(options);
    this.middleware = this.middleware.bind(this);
  }

  private setupHeaders(options: SecurityHeaders): void {
    const defaultDirectives = {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "font-src": ["'self'", "https:", "data:"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "img-src": ["'self'", "data:"],
      "object-src": ["'none'"],
      "script-src": ["'self'"],
      "script-src-attr": ["'none'"],
      "style-src": ["'self'"],
      "upgrade-insecure-requests": [],
    };

    const defaultHeaders = {
      contentSecurityPolicy: { directives: defaultDirectives },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      originAgentCluster: true,
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: "SAMEORIGIN" },
      xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
      xPoweredBy: false,
      xXssProtection: false,
      useNonce: false,
    };

    const userCsp = options.contentSecurityPolicy;
    const userDirectives = userCsp && typeof userCsp === "object" && userCsp.directives ? userCsp.directives : {};
    const mergedDirectives = { ...defaultDirectives, ...userDirectives };
    const finalCsp =
      userCsp === false
        ? false
        : {
            ...defaultHeaders.contentSecurityPolicy,
            ...(typeof userCsp === "object" ? userCsp : {}),
            directives: mergedDirectives,
          };

    this.headers = {
      ...defaultHeaders,
      ...options,
      contentSecurityPolicy: finalCsp,
    };
  }

  private generateNonce(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString("hex");
  }

  private setNonce(ip: string, nonce: string): void {
    if (this.nonceStore.size >= this.maxNoncesKeys && !this.nonceStore.has(ip)) {
      const firstKey = this.nonceStore.keys().next().value;
      if (firstKey !== undefined) this.nonceStore.delete(firstKey);
    }
    this.nonceStore.set(ip, nonce);
  }

  private applyHeaders(response: Response, nonce?: string): void {
    const headers = response.headers;

    // Content-Security-Policy
    if (this.headers.contentSecurityPolicy && typeof this.headers.contentSecurityPolicy !== "boolean") {
      const cspDirectives = { ...this.headers.contentSecurityPolicy.directives };

      if (nonce && this.headers.useNonce) {
        if (cspDirectives["script-src"]) {
          cspDirectives["script-src"] = [...cspDirectives["script-src"], `'nonce-${nonce}'`];
        }
        if (cspDirectives["style-src"]) {
          cspDirectives["style-src"] = [...cspDirectives["style-src"], `'nonce-${nonce}'`];
        }
      }

      const csp = Object.entries(cspDirectives)
        .map(([key, values]) => `${key} ${values.join(" ")}`)
        .join("; ");

      headers.set("Content-Security-Policy", csp);
    }

    // Cross-Origin-Opener-Policy
    if (this.headers.crossOriginOpenerPolicy && typeof this.headers.crossOriginOpenerPolicy !== "boolean") {
      headers.set("Cross-Origin-Opener-Policy", this.headers.crossOriginOpenerPolicy.policy);
    }

    // Cross-Origin-Resource-Policy
    if (this.headers.crossOriginResourcePolicy && typeof this.headers.crossOriginResourcePolicy !== "boolean") {
      headers.set("Cross-Origin-Resource-Policy", this.headers.crossOriginResourcePolicy.policy);
    }

    // Origin-Agent-Cluster
    if (this.headers.originAgentCluster) {
      headers.set("Origin-Agent-Cluster", "?1");
    }

    // Referrer-Policy
    if (this.headers.referrerPolicy && typeof this.headers.referrerPolicy !== "boolean") {
      const policy = Array.isArray(this.headers.referrerPolicy.policy)
        ? this.headers.referrerPolicy.policy.join(", ")
        : this.headers.referrerPolicy.policy;
      headers.set("Referrer-Policy", policy);
    }

    // Strict-Transport-Security
    if (this.headers.strictTransportSecurity && typeof this.headers.strictTransportSecurity !== "boolean") {
      const hsts = [
        `max-age=${this.headers.strictTransportSecurity.maxAge}`,
        this.headers.strictTransportSecurity.includeSubDomains ? "includeSubDomains" : "",
        this.headers.strictTransportSecurity.preload ? "preload" : "",
      ]
        .filter(Boolean)
        .join("; ");
      headers.set("Strict-Transport-Security", hsts);
    }

    // X-Content-Type-Options
    if (this.headers.xContentTypeOptions) {
      headers.set("X-Content-Type-Options", "nosniff");
    }

    // X-DNS-Prefetch-Control
    if (this.headers.xDnsPrefetchControl && typeof this.headers.xDnsPrefetchControl !== "boolean") {
      headers.set("X-DNS-Prefetch-Control", this.headers.xDnsPrefetchControl.allow ? "on" : "off");
    }

    // X-Download-Options
    if (this.headers.xDownloadOptions) {
      headers.set("X-Download-Options", "noopen");
    }

    // X-Frame-Options
    if (this.headers.xFrameOptions && typeof this.headers.xFrameOptions !== "boolean") {
      headers.set("X-Frame-Options", this.headers.xFrameOptions.action);
    }

    // X-Permitted-Cross-Domain-Policies
    if (this.headers.xPermittedCrossDomainPolicies && typeof this.headers.xPermittedCrossDomainPolicies !== "boolean") {
      headers.set("X-Permitted-Cross-Domain-Policies", this.headers.xPermittedCrossDomainPolicies.permittedPolicies);
    }

    // X-Powered-By
    if (this.headers.xPoweredBy === false) {
      headers.delete("X-Powered-By");
    }

    // X-XSS-Protection
    if (this.headers.xXssProtection === false) {
      headers.set("X-XSS-Protection", "0");
    }
  }

  private getClientIP(req: Request, getIp: (req: Request) => string | null): string {
    const serverIp = getIp(req);

    if (!serverIp && this.trustProxy) {
      return (
        req.headers.get("x-forwarded-for") ||
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-real-ip") ||
        "unknown"
      );
    }

    return serverIp || "unknown";
  }

  public middleware(getIp: (req: Request) => string | null) {
    return (req: Request, res: Response, next: () => void) => {
      const ip = this.getClientIP(req, getIp);
      const nonce = this.generateNonce();

      this.setNonce(ip, nonce);
      this.applyHeaders(res, nonce);

      next();
    };
  }

  public getNonce(ip: string): string {
    const nonce = this.nonceStore.get(ip);

    if (nonce) {
      this.nonceStore.delete(ip);
    }

    return nonce || "fallback-nonce";
  }
}
