# Research: App Detail Page Improvements

**Feature**: 012-app-detail-improvements
**Date**: 2025-12-28

## Research Tasks

### 1. File Upload in NestJS

**Question**: How to implement file upload in NestJS for icon images?

**Decision**: Use NestJS built-in file upload with `@nestjs/platform-express` (already installed) and multer.

**Rationale**:
- `@nestjs/platform-express` is already a dependency
- NestJS provides `@UseInterceptors(FileInterceptor())` decorator for handling file uploads
- Multer is the de facto standard for Express-based file uploads
- Can validate file type and size at interceptor level

**Alternatives considered**:
- Base64 encoding in JSON: Rejected - larger payload, no streaming, harder to validate
- Third-party upload services (S3, Cloudinary): Rejected - overkill for POC, adds external dependency

**Implementation notes**:
```typescript
// Example endpoint structure
@Post(':id/icon')
@UseInterceptors(FileInterceptor('icon', {
  storage: diskStorage({
    destination: './uploads/icons',
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}.png`)
  }),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/^image\/(png|jpeg|gif|webp)$/)) {
      cb(new BadRequestException('Invalid file type'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
}))
async uploadIcon(@Param('id') id: string, @UploadedFile() file: Express.Multer.File)
```

### 2. Client-side Image Validation

**Question**: How to validate image dimensions (128x128 minimum, square) before upload?

**Decision**: Use browser Image API to load the image and check dimensions before form submission.

**Rationale**:
- Provides immediate feedback without server round-trip
- Standard browser API, no additional dependencies
- Can reject invalid files before upload starts

**Implementation notes**:
```typescript
const validateImageDimensions = (file: File): Promise<{ valid: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width < 128 || img.height < 128) {
        resolve({ valid: false, error: 'Image must be at least 128x128 pixels' });
      } else if (img.width !== img.height) {
        resolve({ valid: false, error: 'Image must be square' });
      } else {
        resolve({ valid: true });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve({ valid: false, error: 'Invalid image file' });
    };
    img.src = URL.createObjectURL(file);
  });
};
```

### 3. Default Pixel Art Icons

**Question**: How to create and store 8 distinct pixel art icons?

**Decision**: Create 8 PNG files (128x128) with simple pixel art designs in distinct colors, store in `packages/frontend/public/icons/`.

**Rationale**:
- Static assets in public folder are served directly by Vite
- 128x128 PNG files are small (~1-5KB each with simple designs)
- Referenced by path like `/icons/icon-red.png`

**Color palette** (8 distinct colors):
1. Red (#EF4444)
2. Orange (#F97316)
3. Yellow (#EAB308)
4. Green (#22C55E)
5. Blue (#3B82F6)
6. Purple (#A855F7)
7. Pink (#EC4899)
8. Gray (#6B7280)

**Design approach**: Simple 8x8 or 16x16 pixel art scaled to 128x128, maintaining crisp edges. Each icon should have a unique simple shape (cube, star, heart, diamond, etc.) with the color as accent.

### 4. Random Icon Assignment

**Question**: How to randomly assign one of 8 icons when creating an app?

**Decision**: Generate random selection in backend `AppService.create()` and store the icon path in `iconUrl` field.

**Rationale**:
- Backend owns the creation logic
- Ensures consistency - icon is assigned atomically with app creation
- Uses existing `logoUrl` field (repurposed as `iconUrl`)

**Implementation notes**:
```typescript
const DEFAULT_ICONS = [
  '/icons/icon-red.png',
  '/icons/icon-orange.png',
  '/icons/icon-yellow.png',
  '/icons/icon-green.png',
  '/icons/icon-blue.png',
  '/icons/icon-purple.png',
  '/icons/icon-pink.png',
  '/icons/icon-gray.png',
];

function getRandomDefaultIcon(): string {
  return DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
}
```

### 5. Edit Mode Detection

**Question**: How is "edit mode" defined in the current UI for showing the icon upload overlay?

**Decision**: The app detail page currently doesn't have a distinct "edit mode" toggle. Implement the icon upload overlay as always-visible on hover when the user has permission to edit (which in POC mode is always).

**Rationale**:
- POC mode has no authentication, so all users can edit
- Adding a full edit mode toggle is scope creep
- Hover-to-reveal upload is a common pattern (GitHub profile, Slack workspace icons)

**Implementation notes**:
- Show camera/upload icon overlay on hover over the app icon
- Click triggers file input dialog
- No separate "edit mode" toggle needed for POC

### 6. Modal Component Pattern

**Question**: What modal pattern is used in the existing codebase?

**Decision**: Follow the existing `CreateFlowModal` pattern which uses a simple React component with Tailwind styling.

**Rationale**:
- Consistent with existing codebase patterns
- No additional dependencies needed
- Uses backdrop blur and centered dialog styling already established

**Existing pattern** (from CreateFlowModal):
- `isOpen` boolean prop controls visibility
- Backdrop with click-to-close
- Centered content with `max-w-md` or similar sizing
- Close button and form actions

### 7. Serving Uploaded Files

**Question**: How to serve user-uploaded icon files from the backend?

**Decision**: Use NestJS `ServeStaticModule` or a dedicated static file route for the uploads directory.

**Rationale**:
- NestJS can serve static files directly
- Uploaded icons stored in `uploads/icons/` directory
- URL pattern: `/uploads/icons/{filename}`

**Implementation notes**:
```typescript
// In app.module.ts
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'uploads'),
  serveRoot: '/uploads',
}),
```

Or simpler: serve via express static middleware in main.ts:
```typescript
app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
```

## Summary

All research tasks completed. Key decisions:
1. Use NestJS FileInterceptor with multer for uploads
2. Client-side validation using browser Image API
3. 8 static PNG icons in public folder with distinct colors
4. Random icon assignment in backend create method
5. Hover-to-upload pattern instead of full edit mode toggle
6. Follow existing modal pattern from CreateFlowModal
7. Serve uploads via express static middleware
