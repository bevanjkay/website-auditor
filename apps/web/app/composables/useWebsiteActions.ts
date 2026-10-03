export function useWebsiteActions(websiteId: MaybeRefOrGetter<string>, onChange: () => Promise<unknown>) {
  const runPending = ref(false);
  const archivePending = ref(false);
  const actionError = ref("");

  async function runAudit() {
    runPending.value = true;
    actionError.value = "";
    try {
      const response = await $fetch<{ auditRun: { id: string } }>(`/api/websites/${toValue(websiteId)}/audits`, { method: "POST" });
      await navigateTo(`/audits/${response.auditRun.id}`);
      return true;
    }
    catch (error) {
      actionError.value = getErrorMessage(error, "Couldn't start the audit.");
      return false;
    }
    finally {
      runPending.value = false;
    }
  }

  async function setArchived(archived: boolean) {
    archivePending.value = true;
    actionError.value = "";
    try {
      await $fetch(`/api/websites/${toValue(websiteId)}`, { method: "PATCH", body: { isActive: !archived } });
      await onChange();
      return true;
    }
    catch (error) {
      actionError.value = getErrorMessage(error, archived ? "Couldn't archive the website." : "Couldn't restore the website.");
      return false;
    }
    finally {
      archivePending.value = false;
    }
  }

  return { runPending, archivePending, actionError, runAudit, setArchived };
}
