export function moveProductImageInOrder<T extends { id: string }>(
  images: readonly T[],
  imageId: string,
  direction: "up" | "down",
) {
  const currentIndex = images.findIndex((image) => image.id === imageId);
  if (currentIndex < 0) return null;
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= images.length) return [...images];
  const ordered = [...images];
  [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
  return ordered;
}
