### Project Create: `npx express-mod-cli create my-project`

### cd my-project

### Route create: `npx express-mod-cli add users`

```


    To get started:
      cd projectName
      npm run dev

    1. Update MongoDB URI:
       - Open the .env file located in the root of the project directory.
       - Replace the placeholder MongoDB URI with your actual MongoDB URI.
       - Example:
         MONGODB_URI=mongodb://localhost:27017/yourDB_name

    2. Add your database name:
       - You can specify the database name directly in the MongoDB URI as shown above,
         or set it as a separate environment variable:
         DB_NAME=yourDB_name

    3. Example .env file setup:
       - MONGODB_URI=mongodb://localhost:27017/yourDB_name
       - DB_NAME=yourDB_name
       - PORT=5000

    4. Save the .env file and restart the server to apply changes.

    To add new modules:
      npx express-mod-cli add <module-name>
```
