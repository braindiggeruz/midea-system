# Token Access Findings

## GitHub

- Official docs page: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- GitHub recommends **fine-grained personal access tokens** where possible.
- Creation flow from docs: Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token.
- Docs state that the token should use the **minimal repository access** and **minimal permissions necessary**.
- Fine-grained tokens can be limited to **Only select repositories**.

## Railway

- Official docs page: https://docs.railway.com/integrations/api
- Railway docs distinguish **project tokens** for deployments and service-specific automation.
- Docs state that **project tokens are scoped to a specific environment within a project** and can only authenticate requests to that environment.
- This suggests project token is preferable over a broad account-wide token when the goal is autonomous deployment of a single app.

## Cloudflare

- Official docs page: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- Cloudflare supports both **user tokens** and **Account API tokens**; account-owned tokens are preferable when compatible and when a service token is needed instead of a user-bound token.
- Creation path from docs: My Profile -> API Tokens (for user tokens) or Manage Account -> API Tokens (for account-owned tokens) -> Create Token.
- Cloudflare docs use the **Edit zone DNS** template as the example and state that permissions and resources should be narrowed to the specific zone.
- Docs also allow restricting token use by **TTL** and **Client IP Address Filtering**.

## GitHub permissions detail

- Official permissions reference: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- The permissions reference shows repository **Contents** write access is used for file content writes and git reference updates needed for pushing code through the API.
- For a repository-scoped automation flow, fine-grained PAT should at minimum include access to the target repository with **Metadata: Read** and **Contents: Read and write**.
