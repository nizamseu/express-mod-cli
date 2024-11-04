### Project Create: `npx express-app-generator create my-project`

cd my-project

### Route create: `npx express-app-generator add users`

npx . create my-project

# or

npx . add users

npx . create my-project
cd my-project

npx . add users

express-app-generator/
├── package.json
└── bin/
└── index.js

chmod +x bin/index.js

npm init -y # Creates initial package.json
npm install # Install dependencies
npm link # Creates a global link

project/
├── src/
│ ├── config/
│ │ └── db.js
│ ├── middleware/
│ │ └── errorHandler.js
│ ├── modules/
│ │ └── [module-name]/
│ │ ├── module.model.js
│ │ ├── module.controller.js
│ │ └── module.routes.js
│ ├── utils/
│ └── index.js
├── .env
├── .gitignore
└── package.json