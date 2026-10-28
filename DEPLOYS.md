# Deploys

| When (CT) | Worker version | Deployment | Rollback point |
| --- | --- | --- | --- |
| 2026-10-28 09:54 | 3e7e6c78-c718-4231-93de-5fc518711e45 | 87017033-4edf-4a25-8c4a-3aa2c116ef66 | First deploy. To take it offline without deleting, disable the workers.dev route; later deploys roll back to this version id. |

Post-deploy check (09:55 CT): `/v1/health` ok, `/` 200, demo extract returns 3 chapters / 3 action items; headless Chrome renders the playground.
