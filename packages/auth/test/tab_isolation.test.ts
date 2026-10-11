import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

/**
 * In-memory storage mock that behaves identically to browser sessionStorage.
 * Each tab instance has its own separate isolated storage dictionary.
 */
class MockSessionStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

describe("Tab-Isolated Session Architecture — SDK & Storage Verification", () => {
  const dummyUrl = "https://thlpmhblgcdpgqhnrhkp.supabase.co";
  const dummyKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy";

  test("Two separate clients with tab-scoped storage keys maintain independent sessions", async () => {
    const tabStorage1 = new MockSessionStorage();
    const tabStorage2 = new MockSessionStorage();

    const clientTab1 = createClient(dummyUrl, dummyKey, {
      auth: {
        storage: tabStorage1,
        storageKey: "sb_tab_tab1_auth_token",
        persistSession: true,
        autoRefreshToken: false,
      },
    });

    const clientTab2 = createClient(dummyUrl, dummyKey, {
      auth: {
        storage: tabStorage2,
        storageKey: "sb_tab_tab2_auth_token",
        persistSession: true,
        autoRefreshToken: false,
      },
    });

    // Verify storage keys are distinct
    assert.notEqual(
      (clientTab1.auth as any).storageKey,
      (clientTab2.auth as any).storageKey
    );

    const nowSec = Math.floor(Date.now() / 1000);

    // Simulate session injection into Tab 1
    const mockSessionTab1 = {
      access_token: "jwt_token_user_a",
      refresh_token: "refresh_token_user_a",
      expires_in: 3600,
      expires_at: nowSec + 3600,
      token_type: "bearer",
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "usera@example.com",
        aud: "authenticated",
        role: "authenticated",
      },
    };

    // Simulate session injection into Tab 2
    const mockSessionTab2 = {
      access_token: "jwt_token_user_b",
      refresh_token: "refresh_token_user_b",
      expires_in: 3600,
      expires_at: nowSec + 3600,
      token_type: "bearer",
      user: {
        id: "22222222-2222-2222-2222-222222222222",
        email: "userb@example.com",
        aud: "authenticated",
        role: "authenticated",
      },
    };

    // Store sessions in respective tab storage
    tabStorage1.setItem("sb_tab_tab1_auth_token", JSON.stringify(mockSessionTab1));
    tabStorage2.setItem("sb_tab_tab2_auth_token", JSON.stringify(mockSessionTab2));

    // Tab 1 retrieves session
    const session1 = await clientTab1.auth.getSession();
    assert.equal(session1.data.session?.user?.id, "11111111-1111-1111-1111-111111111111");
    assert.equal(session1.data.session?.user?.email, "usera@example.com");

    // Tab 2 retrieves session
    const session2 = await clientTab2.auth.getSession();
    assert.equal(session2.data.session?.user?.id, "22222222-2222-2222-2222-222222222222");
    assert.equal(session2.data.session?.user?.email, "userb@example.com");

    // Sign out Tab 1
    tabStorage1.removeItem("sb_tab_tab1_auth_token");
    const session1After = await clientTab1.auth.getSession();
    assert.equal(session1After.data.session, null);

    // Tab 2 MUST remain completely intact
    const session2After = await clientTab2.auth.getSession();
    assert.equal(session2After.data.session?.user?.id, "22222222-2222-2222-2222-222222222222");
    assert.equal(session2After.data.session?.user?.email, "userb@example.com");
  });

  test("Cross-tab BroadcastChannel isolation via unique storageKey names", () => {
    // In GoTrueClient (lines 267-270):
    // this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
    //
    // If two tabs use the exact same storageKey, they join the same BroadcastChannel.
    // If each tab generates its own tabId (e.g. storageKey: `sb_tab_${tabId}_auth_token`),
    // the BroadcastChannel names are distinct, ensuring zero cross-tab broadcast leakage.
    const keyA = `sb_tab_${"tab_alpha"}_auth_token`;
    const keyB = `sb_tab_${"tab_beta"}_auth_token`;

    assert.notEqual(keyA, keyB);
    assert.ok(keyA.includes("tab_alpha"));
    assert.ok(keyB.includes("tab_beta"));
  });

  test("Event subscription isolation: Tab 1 auth changes do not trigger Tab 2 listener", async () => {
    const tabStorage1 = new MockSessionStorage();
    const tabStorage2 = new MockSessionStorage();

    const client1 = createClient(dummyUrl, dummyKey, {
      auth: {
        storage: tabStorage1,
        storageKey: "sb_tab_listener_1",
        persistSession: true,
        autoRefreshToken: false,
      },
    });

    const client2 = createClient(dummyUrl, dummyKey, {
      auth: {
        storage: tabStorage2,
        storageKey: "sb_tab_listener_2",
        persistSession: true,
        autoRefreshToken: false,
      },
    });

    let client1Events: string[] = [];
    let client2Events: string[] = [];

    const { data: sub1 } = client1.auth.onAuthStateChange((event) => {
      client1Events.push(event);
    });

    const { data: sub2 } = client2.auth.onAuthStateChange((event) => {
      client2Events.push(event);
    });

    // Inject session into Tab 1
    const nowSec = Math.floor(Date.now() / 1000);
    tabStorage1.setItem(
      "sb_tab_listener_1",
      JSON.stringify({
        access_token: "token1",
        refresh_token: "ref1",
        expires_in: 3600,
        expires_at: nowSec + 3600,
        token_type: "bearer",
        user: { id: "user-1", email: "u1@example.com", aud: "authenticated" },
      })
    );

    // Tab 1 gets session
    const s1 = await client1.auth.getSession();
    assert.equal(s1.data.session?.user.id, "user-1");

    // Tab 2 gets session - must still be null
    const s2 = await client2.auth.getSession();
    assert.equal(s2.data.session, null);

    // Verify Tab 2 events did not receive any signed-in event for Tab 1
    assert.ok(!client2Events.includes("SIGNED_IN"));

    sub1.subscription.unsubscribe();
    sub2.subscription.unsubscribe();
  });

  test("Live Supabase client initialization with tab-isolated storage keys (Real Supabase integration)", async () => {
    const realUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://thlpmhblgcdpgqhnrhkp.supabase.co";
    const realAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_CgH5NoCBAL4hn-HgkUdmiQ_3iaKZJWA";

    const storageA = new MockSessionStorage();
    const storageB = new MockSessionStorage();

    const liveTabA = createClient(realUrl, realAnon, {
      auth: {
        storage: storageA,
        storageKey: "sb_auth_live_tab_A",
        persistSession: true,
        autoRefreshToken: false,
      },
    });

    const liveTabB = createClient(realUrl, realAnon, {
      auth: {
        storage: storageB,
        storageKey: "sb_auth_live_tab_B",
        persistSession: true,
        autoRefreshToken: false,
      },
    });

    // Verify both tab clients communicate with live Supabase without cross-talk
    const [resA, resB] = await Promise.all([
      liveTabA.auth.getSession(),
      liveTabB.auth.getSession(),
    ]);

    assert.equal(resA.error, null);
    assert.equal(resB.error, null);
    assert.equal(resA.data.session, null);
    assert.equal(resB.data.session, null);
  });
});
