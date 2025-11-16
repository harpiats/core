type CSPTypes = { directives: Record<string, string[]> } | boolean;

export type SecurityHeaders = {
	contentSecurityPolicy?: CSPTypes;
	crossOriginOpenerPolicy?: boolean | { policy: string };
	crossOriginResourcePolicy?: boolean | { policy: string };
	originAgentCluster?: boolean;
	referrerPolicy?: boolean | { policy: string | string[] };
	strictTransportSecurity?: boolean | { maxAge: number; includeSubDomains?: boolean; preload?: boolean };
	xContentTypeOptions?: boolean;
	xDnsPrefetchControl?: boolean | { allow: boolean };
	xDownloadOptions?: boolean;
	xFrameOptions?: boolean | { action: string };
	xPermittedCrossDomainPolicies?: boolean | { permittedPolicies: string };
	xPoweredBy?: boolean;
	xXssProtection?: boolean;
	useNonce?: boolean;
};
