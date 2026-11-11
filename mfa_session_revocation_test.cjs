/**
 * MFA Session Revocation Test
 * Tests that a revoked session is refused access to protected routes
 * Simulates the MfaGuardMiddleware logic with a mock SessionStore
 */

// Simulate the MfaGuardMiddleware.checkMfaGuard logic
function createMockSessionStore() {
    const sessions = new Map();
    return {
        async get(sessionId) {
            return sessions.get(sessionId) || null;
        },
        async create(session) {
            sessions.set(session.id, session);
        },
        async revoke(sessionId) {
            sessions.delete(sessionId);
        },
        async revokeAllForIdentity(identityId) {
            for (const [id, session] of sessions.entries()) {
                if (session.identityId === identityId) {
                    sessions.delete(id);
                }
            }
        }
    };
}

async function testSessionRevocation() {
    const sessionStore = createMockSessionStore();
    const currentUserId = 'user-1';
    const tenantId = 'tenant-1';
    const pathname = '/api/protected';

    // Simulate MfaGuardMiddleware.checkMfaGuard logic
    async function checkMfaGuard(pathname, ctx) {
        const exemptRoutes = ['/api/auth/mfa/', '/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/refresh', '/api/health', '/healthz', '/health'];
        for (const exempt of exemptRoutes) {
            if (pathname.startsWith(exempt)) return { allowed: true };
        }
        if (!ctx.currentUserId) return { allowed: true };

        const isEnabled = await ctx.mfaService.isMfaEnabled(ctx.currentUserId, ctx.tenantId);
        if (!isEnabled) return { allowed: true };

        if (!ctx.sessionStore || !ctx.sessionId || !ctx.currentUserId) {
            return { allowed: false, statusCode: 403, mfaRequired: true, body: { error: 'MFA_SESSION_REQUIRED' } };
        }

        try {
            const session = await ctx.sessionStore.get(ctx.sessionId);
            if (!session) {
                return { allowed: false, statusCode: 403, mfaRequired: true, body: { error: 'MFA_SESSION_INVALID' } };
            }
            if (session.identityId !== ctx.currentUserId) {
                return { allowed: false, statusCode: 403, mfaRequired: true, body: { error: 'MFA_SESSION_MISMATCH' } };
            }
            const now = new Date();
            const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;
            if (expiresAt && expiresAt <= now) {
                return { allowed: false, statusCode: 403, mfaRequired: true, body: { error: 'MFA_SESSION_EXPIRED' } };
            }
            if (!session.attributes?.mfaVerified) {
                return { allowed: false, statusCode: 403, mfaRequired: true, body: { error: 'MFA_REQUIRED' } };
            }
        } catch {
            return { allowed: false, statusCode: 403, mfaRequired: true, body: { error: 'MFA_SESSION_ERROR' } };
        }
        return { allowed: true };
    }

    // Mock MfaService
    const mfaService = {
        async isMfaEnabled(userId, tenantId) {
            return true; // MFA is enabled for this user
        }
    };

    // TEST 1: Create a session with mfaVerified: true, access should be allowed
    const sessionId = 'session-123';
    await sessionStore.create({
        id: sessionId,
        identityId: currentUserId,
        tenantId: tenantId,
        attributes: { mfaVerified: true },
        expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    const result1 = await checkMfaGuard(pathname, {
        mfaService, userService: null, currentUserId, tenantId,
        sessionStore, sessionId, mfaExemptRoutes: []
    });
    console.log('Test 1 - Session with mfaVerified=true:');
    console.log(`  Result: ${result1.allowed ? 'ALLOWED' : 'DENIED'} (expected: ALLOWED)`);
    console.log(`  ${result1.allowed ? 'PASS' : 'FAIL'}\n`);

    // TEST 2: Revoke the session, access should be denied
    await sessionStore.revoke(sessionId);
    const result2 = await checkMfaGuard(pathname, {
        mfaService, userService: null, currentUserId, tenantId,
        sessionStore, sessionId, mfaExemptRoutes: []
    });
    console.log('Test 2 - Session revoked, access attempt:');
    console.log(`  Result: ${result2.allowed ? 'ALLOWED' : 'DENIED'} (expected: DENIED with 403)`);
    console.log(`  ${result2.allowed === false && result2.statusCode === 403 ? 'PASS' : 'FAIL'}\n`);

    // TEST 3: Try with a non-existent session ID
    const result3 = await checkMfaGuard(pathname, {
        mfaService, userService: null, currentUserId, tenantId,
        sessionStore, sessionId: 'non-existent-session', mfaExemptRoutes: []
    });
    console.log('Test 3 - Non-existent session ID:');
    console.log(`  Result: ${result3.allowed ? 'ALLOWED' : 'DENIED'} (expected: DENIED with 403)`);
    console.log(`  ${result3.allowed === false && result3.statusCode === 403 ? 'PASS' : 'FAIL'}\n`);

    // TEST 4: Revoke all sessions for an identity
    await sessionStore.create({
        id: 'session-456',
        identityId: currentUserId,
        tenantId: tenantId,
        attributes: { mfaVerified: true },
        expiresAt: new Date(Date.now() + 3600000).toISOString()
    });
    const result4a = await checkMfaGuard(pathname, {
        mfaService, userService: null, currentUserId, tenantId,
        sessionStore, sessionId: 'session-456', mfaExemptRoutes: []
    });
    console.log('Test 4a - Second session with mfaVerified=true:');
    console.log(`  Result: ${result4a.allowed ? 'ALLOWED' : 'DENIED'} (expected: ALLOWED)`);

    // Revoke all sessions for this identity
    await sessionStore.revokeAllForIdentity(currentUserId);
    const result4b = await checkMfaGuard(pathname, {
        mfaService, userService: null, currentUserId, tenantId,
        sessionStore, sessionId: 'session-456', mfaExemptRoutes: []
    });
    console.log('Test 4b - All sessions revoked for identity:');
    console.log(`  Result: ${result4b.allowed ? 'ALLOWED' : 'DENIED'} (expected: DENIED with 403)`);
    console.log(`  ${result4b.allowed === false ? 'PASS' : 'FAIL'}\n`);

    console.log('=== SESSION REVOCATION TESTS COMPLETE ===');
}

testSessionRevocation().catch(console.error);
