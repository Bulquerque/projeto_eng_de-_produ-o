/** Keeps asynchronous UI actions from committing results for an obsolete company/session. */
export function createOperationGuard({ getState, getProvider }) {
  let operationId = 0;
  let activeAction = null;

  function nextOperation() {
    operationId += 1;
    return operationId;
  }

  function isCurrentToken(token) {
    return token === operationId;
  }

  function currentToken() {
    return operationId;
  }

  function isCurrentOperation(token, companyId, ownerProvider = null) {
    const state = getState();
    return (
      isCurrentToken(token) &&
      state.context.company_id === companyId &&
      (!ownerProvider || getProvider() === ownerProvider)
    );
  }

  function beginAction(kind, provider, companyId) {
    if (activeAction) return null;
    activeAction = { kind, activeProvider: provider, companyId, token: operationId };
    return activeAction;
  }

  function isCurrentAction(action) {
    return (
      activeAction === action &&
      isCurrentOperation(action.token, action.companyId, action.activeProvider)
    );
  }

  function finishAction(action) {
    if (activeAction === action) activeAction = null;
  }

  function cancelActiveAction() {
    activeAction = null;
  }

  function hasActiveAction() {
    return activeAction !== null;
  }

  return Object.freeze({
    nextOperation,
    currentToken,
    isCurrentToken,
    isCurrentOperation,
    beginAction,
    isCurrentAction,
    finishAction,
    cancelActiveAction,
    hasActiveAction,
  });
}
