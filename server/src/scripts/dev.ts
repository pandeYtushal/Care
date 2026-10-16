// `npm run dev` must remain a development server even if server/.env was last
// used for deployment. dotenv does not override this explicit process value.
process.env.NODE_ENV = 'development';
void import('../index.js');
