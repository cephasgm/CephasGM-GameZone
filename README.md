📖 Project Overview
CephasGM GameZone is a premium online betting platform built with modern, scalable architecture. This backend service powers the entire platform including sports betting, live casino, virtual games, user management, payments, and real-time odds.

Production-ready with comprehensive security, monitoring, and deployment tooling.

🚀 Features
User Management: Registration, login (email + social OAuth), 2FA, KYC verification, profiles

Wallet & Payments: Multi-currency wallets, deposits/withdrawals via M-Pesa, Airtel, PayPal, crypto, mobile banking, and more

Betting Engine: Single, accumulator, and system bets with real-time odds, cash-out, and settlement

Sports & Matches: Live match updates, odds management, virtual sports (football, horse racing, car racing, netball, adventure games)

Promotions & Bonuses: Welcome bonuses, cashback, VIP rewards, referral bonuses, promotional campaigns

Notifications: Email, push, and SMS alerts for bets, payments, promotions, and security events

Admin Dashboard: User management, payment review, odds control, analytics, and audit logs

Real-time: WebSocket (Socket.IO) for live betting, match updates, odds changes, and chat

Security: JWT with refresh tokens, Argon2 password hashing, 2FA, rate limiting, Helmet, CORS, SQL injection protection, XSS prevention

🛠️ Tech Stack
Component	Technology
Runtime	Node.js 18+
Framework	Express.js
Database	PostgreSQL (Sequelize ORM)
Cache & Session	Redis
Auth	JWT, Passport (Google, Apple, Facebook, GitHub)
Real-time	Socket.IO
Payments	M-Pesa, Airtel, MixbyYas, Halopesa, PayPal, Crypto, Mobile Banking
Notifications	SendGrid/SES, FCM, Twilio/Africa's Talking
Odds	Mock/Real provider integration
Testing	Jest, Supertest
Container	Docker & Docker Compose
CI/CD	GitHub Actions
Monitoring	Winston logging, health checks
📋 Prerequisites
Node.js 18+

PostgreSQL 15+

Redis 7+

Docker & Docker Compose (optional but recommended)

API keys for payment/notification providers (if using real integrations)

🏁 Installation & Setup
1. Clone the repository
bash
git clone https://github.com/cephasgm/cephasgm-gamezone-backend.git
cd cephasgm-gamezone-backend
2. Install dependencies
bash
npm install
3. Configure environment
bash
cp .env.example .env
Edit .env with your local settings (database credentials, JWT secrets, API keys, etc.).

4. Set up databases
bash
# Create PostgreSQL database (using your local DB user)
createdb cephasgm_gamezone

# Run migrations
npm run db:migrate

# Seed initial data (sports, leagues, admin user)
npm run db:seed
5. Start Redis
Ensure Redis is running locally or via Docker:

bash
redis-server
6. Run the application
bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
The API will be available at http://localhost:3000/api/v1.

🐳 Docker Setup (Recommended for Production)
Build and run all services (PostgreSQL, Redis, and the backend) with one command:

bash
docker-compose up -d
This will start:

PostgreSQL on port 5432

Redis on port 6379

Backend on port 3000

Adminer (DB UI) on port 8081 (optional, accessible in dev profile)

To stop:

bash
docker-compose down
🧪 Testing
Run the test suite:

bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run integration tests only
npm run test:integration

# Watch mode
npm run test:watch
📡 API Documentation
The API follows RESTful conventions with GraphQL support (optional).
Key endpoints:

Method	Endpoint	Description
POST	/api/v1/auth/register	User registration
POST	/api/v1/auth/login	User login
GET	/api/v1/users/me	Get current user profile
GET	/api/v1/wallet/balance	Get wallet balance
POST	/api/v1/bets/place	Place a bet
GET	/api/v1/matches/live	Get live matches
POST	/api/v1/payments/deposit	Initiate deposit
GET	/api/v1/bonuses/active	Get active bonuses
GET	/api/v1/admin/dashboard	Admin dashboard (admin only)
Full API documentation is available via Postman/OpenAPI (see /docs folder).

🚢 Deployment
Production deployment with Docker
Set production environment variables (use .env.production or system env).

Build and push the image to your container registry.

Deploy using your preferred orchestration (Kubernetes, ECS, or Docker Swarm).

For a simple deployment using docker-compose.prod.yml:

bash
docker-compose -f docker-compose.prod.yml up -d
Environment Variables for Production
Ensure all required secrets are set, especially:

JWT_SECRET, JWT_REFRESH_SECRET

Database credentials

Payment gateway API keys

Notification service keys

NODE_ENV=production

🛡️ Security
All passwords hashed with Argon2

JWT tokens with refresh rotation

2FA support (TOTP)

Rate limiting per user/IP

Helmet.js for secure headers

CORS restricted to allowed origins

Input validation & sanitization

SQL injection protection (via Sequelize)

Audit logging for critical actions

🤝 Contributing
Fork the repository.

Create a feature branch: git checkout -b feature/your-feature

Commit your changes: git commit -am 'Add feature'

Push to the branch: git push origin feature/your-feature

Open a Pull Request.

Please run tests and ensure all checks pass before submitting.

📄 License
Copyright © 2025 Cephas GM – All rights reserved.
This project is proprietary and confidential.

📬 Contact
Project Owner: CephasGM

Email: admin@cephasgm.com

Website: https://gamezone.cephasgm.com

🎯 Acknowledgements
Built with ❤️ by CephasGM
Innovating for Tomorrow.
