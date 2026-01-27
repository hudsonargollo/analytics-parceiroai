# Subscription Recovery Analytics - Frontend

React dashboard for subscription recovery analytics built with modern web technologies.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Re-usable component library built on Radix UI
- **Framer Motion** - Animation library
- **React Query** - Data fetching and caching
- **Recharts** - Data visualization library
- **Vitest** - Testing framework
- **React Testing Library** - Component testing utilities

## Project Structure

```
src/
├── components/
│   └── ui/              # shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── toast.tsx
│       └── toaster.tsx
├── hooks/
│   └── use-toast.ts     # Toast notification hook
├── lib/
│   ├── api.ts           # API client
│   └── utils.ts         # Utility functions
├── test/
│   └── setup.ts         # Test setup
├── App.tsx              # Main app component
├── main.tsx             # Entry point
├── index.css            # Global styles
└── vite-env.d.ts        # Vite environment types
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run test:unit` - Run unit tests only
- `npm run test:property` - Run property-based tests only
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run deploy` - Build and deploy to Cloudflare Pages

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8787
VITE_API_KEY=your-api-key-here
```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Testing

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## shadcn/ui Components

This project uses shadcn/ui components. The configuration is in `components.json`.

### Installed Components

- Badge - Status indicators
- Button - Interactive buttons
- Card - Content containers
- Label - Form labels
- Select - Dropdown selects
- Skeleton - Loading placeholders
- Table - Data tables
- Toast - Notifications

### Adding New Components

To add more shadcn/ui components, use the CLI:

```bash
npx shadcn-ui@latest add [component-name]
```

## API Client

The API client is configured in `src/lib/api.ts` and includes:

- Automatic API key injection
- Error handling
- Type-safe endpoints for:
  - Recovery rate metrics
  - DSO metrics
  - Cohort analysis
  - Customer billing (Chatwoot integration)

## React Query Configuration

React Query is configured with:
- 5-minute stale time for cached data
- 3 automatic retries on failure
- Optimized for the analytics use case

## Styling

This project uses Tailwind CSS with a custom design system:

- CSS variables for theming (light/dark mode support)
- Custom color palette
- Responsive design utilities
- Animation utilities via tailwindcss-animate

## Deployment

Deploy to Cloudflare Pages:

```bash
npm run deploy
```

This will:
1. Build the production bundle
2. Deploy to Cloudflare Pages using Wrangler

## License

MIT
