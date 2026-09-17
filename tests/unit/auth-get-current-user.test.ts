import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Isolated getCurrentUser / provider / callback tests —
 * mocks next-auth before importing lib/auth.
 */
describe("getCurrentUser and auth providers", () => {
  const authMock = vi.fn();
  const upsertMock = vi.fn();
  const findOrCreateMock = vi.fn();
  let googleFactory: ReturnType<typeof vi.fn>;
  let credentialsFactory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    upsertMock.mockReset();
    findOrCreateMock.mockReset();
    googleFactory = vi.fn((opts: unknown) => ({ id: "google", options: opts }));
    credentialsFactory = vi.fn((cfg: unknown) => ({ id: "credentials", ...(cfg as object) }));

    vi.doMock("next-auth", () => ({
      default: () => ({
        handlers: { GET: vi.fn(), POST: vi.fn() },
        auth: authMock,
        signIn: vi.fn(),
        signOut: vi.fn(),
      }),
    }));
    vi.doMock("next-auth/providers/google", () => ({ default: googleFactory }));
    vi.doMock("next-auth/providers/credentials", () => ({ default: credentialsFactory }));
    vi.doMock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: { userSettings: { upsert: upsertMock } },
    }));
    vi.doMock("@/lib/local-auth", () => ({ findOrCreateLocalUser: findOrCreateMock }));
    vi.doMock("@/lib/auth.config", () => ({
      authConfig: {
        trustHost: true,
        secret: "test-secret-at-least-16-chars",
        session: { strategy: "jwt" },
        pages: { signIn: "/auth/signin" },
        providers: [],
        callbacks: {},
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock("next-auth");
    vi.doUnmock("next-auth/providers/google");
    vi.doUnmock("next-auth/providers/credentials");
    vi.doUnmock("@auth/prisma-adapter");
    vi.doUnmock("@/lib/prisma");
    vi.doUnmock("@/lib/local-auth");
    vi.doUnmock("@/lib/auth.config");
    vi.unstubAllEnvs();
  });

  it("NODE_ENV=production with OAuth missing → module load throws, no session issued", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_GOOGLE_ID", "");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");

    await expect(import("@/lib/auth")).rejects.toThrow(
      /AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required/
    );
    expect(authMock).not.toHaveBeenCalled();
  });

  it("throws Unauthorized when there is no active session", async () => {
    vi.stubEnv("NODE_ENV", "development");
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/lib/auth");
    await expect(getCurrentUser()).rejects.toThrow(/Unauthorized: no active session/);
    expect(authMock).toHaveBeenCalled();
  });

  it("dev bypass path: returns session user outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    authMock.mockResolvedValue({
      user: { id: "u1", email: "dev@example.com", name: "Dev" },
      expires: new Date().toISOString(),
    });

    const { getCurrentUser, isDevCredentialsEnabled } = await import("@/lib/auth");
    expect(isDevCredentialsEnabled()).toBe(true);
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "u1",
      email: "dev@example.com",
    });
  });

  it("buildAuthProviders: credentials only outside production; Google when configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { buildAuthProviders } = await import("@/lib/auth");

    const prodNone = buildAuthProviders({
      NODE_ENV: "production",
      AUTH_GOOGLE_ID: undefined,
      AUTH_GOOGLE_SECRET: undefined,
    });
    expect(prodNone).toHaveLength(0);

    const prodGoogle = buildAuthProviders({
      NODE_ENV: "production",
      AUTH_GOOGLE_ID: "gid",
      AUTH_GOOGLE_SECRET: "gsec",
    });
    expect(prodGoogle).toHaveLength(1);
    expect(prodGoogle[0]).toMatchObject({ id: "google" });

    const devBoth = buildAuthProviders({
      NODE_ENV: "development",
      AUTH_GOOGLE_ID: "gid",
      AUTH_GOOGLE_SECRET: "gsec",
    });
    expect(devBoth).toHaveLength(2);
  });

  it("dev credentials authorize creates a local user and inherits no foreign rows", async () => {
    vi.stubEnv("NODE_ENV", "development");
    findOrCreateMock.mockResolvedValue({
      id: "new-user",
      name: "alice",
      email: "alice@example.com",
      image: null,
    });

    const { buildAuthProviders } = await import("@/lib/auth");
    buildAuthProviders({ NODE_ENV: "development" });
    const credsCall = credentialsFactory.mock.calls.at(-1)?.[0] as {
      authorize: (c: Record<string, string>) => Promise<unknown>;
    };
    const result = await credsCall.authorize({ email: "alice@example.com", name: "Alice" });
    expect(findOrCreateMock).toHaveBeenCalledWith("alice@example.com", "Alice");
    expect(result).toMatchObject({ id: "new-user", email: "alice@example.com" });
  });

  it("jwt callback upserts settings for the signing-in user only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    upsertMock.mockResolvedValue({});

    const { authCallbacks, ensureUserSettings } = await import("@/lib/auth");
    await ensureUserSettings("user-xyz");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-xyz" },
        create: expect.objectContaining({ userId: "user-xyz" }),
      })
    );

    const token = await authCallbacks.jwt!({
      token: {},
      user: { id: "user-xyz", email: "x@y.com" },
      account: null,
      profile: undefined,
      trigger: "signIn",
    } as never);
    expect(token!.id).toBe("user-xyz");
    expect(token!.sub).toBe("user-xyz");

    const session = await authCallbacks.session!({
      session: { user: { email: "x@y.com" }, expires: "" },
      token: { id: "user-xyz", sub: "user-xyz" },
    } as never);
    expect(session.user!.id).toBe("user-xyz");

    await expect(authCallbacks.signIn!({} as never)).resolves.toBe(true);
  });
});
