// A tiny shared flag so the post panel can warn before closing with unsaved changes.
let dirty = false
export const setDirty = (v: boolean) => {
  dirty = v
}
export const isDirty = () => dirty
