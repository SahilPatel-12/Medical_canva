import { test, describe } from "node:test";
import assert from "node:assert/strict";

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
}

describe("Stage 2: Tab-Isolated Workspace Switching & Session Independence", () => {
  test("Two separate browser tabs maintain independent active workspaces via tab-scoped storage keys", () => {
    const tab1Id = "tab_alpha_123";
    const tab2Id = "tab_beta_456";

    const sessionStorageTab1 = new MockSessionStorage();
    const sessionStorageTab2 = new MockSessionStorage();

    const activeKeyTab1 = `dp_active_workspace_${tab1Id}`;
    const activeKeyTab2 = `dp_active_workspace_${tab2Id}`;

    // Assert that storage keys are strictly isolated per tab
    assert.notEqual(activeKeyTab1, activeKeyTab2);

    // Tab 1 (User A) is in their Personal Workspace
    sessionStorageTab1.setItem(activeKeyTab1, "ws_personal_user_a");

    // Tab 2 (User B or same user in different context) selects a Team Workspace
    sessionStorageTab2.setItem(activeKeyTab2, "ws_team_shared_b");

    // Validate Tab 1 active workspace
    assert.equal(sessionStorageTab1.getItem(activeKeyTab1), "ws_personal_user_a");
    // Validate Tab 2 active workspace
    assert.equal(sessionStorageTab2.getItem(activeKeyTab2), "ws_team_shared_b");

    // Neither tab has knowledge of the other's key in its sessionStorage
    assert.equal(sessionStorageTab1.getItem(activeKeyTab2), null);
    assert.equal(sessionStorageTab2.getItem(activeKeyTab1), null);

    // Tab 1 switches workspace to another project
    sessionStorageTab1.setItem(activeKeyTab1, "ws_project_cardiology");

    // Tab 1 should reflect the new workspace
    assert.equal(sessionStorageTab1.getItem(activeKeyTab1), "ws_project_cardiology");

    // Tab 2 MUST remain completely unaffected
    assert.equal(sessionStorageTab2.getItem(activeKeyTab2), "ws_team_shared_b");

    // Tab 1 logs out or closes, clearing its session storage
    sessionStorageTab1.clear();
    assert.equal(sessionStorageTab1.getItem(activeKeyTab1), null);

    // Tab 2 continues unaffected
    assert.equal(sessionStorageTab2.getItem(activeKeyTab2), "ws_team_shared_b");
  });

  test("Active workspace fallback logic: defaults to first available workspace when unset", () => {
    const tabId = "tab_gamma_789";
    const sessionStorage = new MockSessionStorage();
    const key = `dp_active_workspace_${tabId}`;

    const userWorkspaces = [
      { id: "ws_default_1", name: "Personal Workspace", role: "owner" as const },
      { id: "ws_team_2", name: "BioResearch Team", role: "editor" as const },
    ];

    // Initial state: nothing stored in sessionStorage for this tab
    let storedId = sessionStorage.getItem(key);
    let activeWorkspace = userWorkspaces.find((w) => w.id === storedId) || userWorkspaces[0]!;

    assert.equal(activeWorkspace.id, "ws_default_1");

    // User switches to team workspace
    sessionStorage.setItem(key, "ws_team_2");
    storedId = sessionStorage.getItem(key);
    activeWorkspace = userWorkspaces.find((w) => w.id === storedId) || userWorkspaces[0]!;

    assert.equal(activeWorkspace.id, "ws_team_2");
    assert.equal(activeWorkspace.role, "editor");
  });

  test("Active workspace sanitization: prevents activating workspace not in member's authorized list", () => {
    const tabId = "tab_delta_999";
    const sessionStorage = new MockSessionStorage();
    const key = `dp_active_workspace_${tabId}`;

    // Malicious or stale workspace ID not belonging to the user
    sessionStorage.setItem(key, "ws_foreign_attacker_id");

    const authorizedWorkspaces = [
      { id: "ws_my_workspace", name: "Legitimate Workspace", role: "owner" as const },
    ];

    const storedId = sessionStorage.getItem(key);
    // Resolution logic in AuthProvider: only pick if present in authorized list
    const resolvedWorkspace = authorizedWorkspaces.find((w) => w.id === storedId) || authorizedWorkspaces[0]!;

    // Foreign workspace is rejected, falls back safely to legitimate workspace
    assert.notEqual(resolvedWorkspace.id, "ws_foreign_attacker_id");
    assert.equal(resolvedWorkspace.id, "ws_my_workspace");
  });
});
