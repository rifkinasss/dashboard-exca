export function shouldRefreshData(now: number, lastRefresh: number, interval: number, visible: boolean, editing: boolean, dialogOpen: boolean): boolean {
  return visible && !editing && !dialogOpen && now - lastRefresh >= interval;
}
