# Accessibility

This project includes basic keyboard and assistive-technology support for its file-selection and game flow. The notes below describe the current implementation; they are not a claim of WCAG conformance.

## Keyboard interaction

1. Activate **Choose File** to open the native file picker.
2. After a valid file is selected, keyboard focus moves to the game field.
3. Press **Enter** or **Space** while the field is focused to take a straight shot.
4. To aim manually, use a mouse or touch screen to drag the file token backward and release it.

The keyboard interaction intentionally provides a simple straight shot. Fine-grained aiming and drag gestures are currently pointer/touch interactions.

## Assistive technology

- The file picker is a native button and file input.
- The game canvas has an accessible name and references the keyboard instructions with `aria-describedby`.
- Upload status messages use a polite live region.
- When the result dialog opens, focus moves to its primary action; Tab and Shift+Tab remain within the dialog.
- The result panel is exposed as a modal dialog with an associated heading.
- The stylesheet respects the user's reduced-motion preference.

## Current limitations

- The moving players, goalkeeper, ball position, and game events are drawn on a canvas and are not exposed as a structured game state to screen readers.
- Keyboard users cannot currently aim a shot or select a target direction.
- The project has not been independently audited against WCAG.

## Testing checklist

- Navigate to **Choose File** and activate it using the keyboard.
- Select a file and confirm focus moves to the game field.
- Complete a shot and confirm focus moves to the result dialog's primary action.
- Press Tab and Shift+Tab and confirm focus remains inside the result dialog.
- Select another file and confirm focus returns to the game field.
- Press **Enter** and **Space** to take a shot.
- Confirm a visible focus indicator appears on keyboard-focusable controls.
- Test the file picker, status messages, and result dialog with a screen reader.
- Verify reduced-motion preferences are respected.
