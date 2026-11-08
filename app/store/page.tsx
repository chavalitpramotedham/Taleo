import { GalleryShelf } from "@/components/GalleryShelf";

export default function StorePage() {
  return (
    <div className="container">
      <GalleryShelf
        headClass="wizard-head"
        heading={
          <>
            <p className="eyebrow">Open to everyone</p>
            <h1>The library</h1>
            <p className="sub">Every finished story, painted and shared by families like yours.</p>
          </>
        }
      />
    </div>
  );
}
