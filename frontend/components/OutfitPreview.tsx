type PreviewItem = {
  id: string;
  name: string;
  category: string;
  image_url: string;
};

export function OutfitPreview({ items }: { items: PreviewItem[] }) {
  return (
    <section className="planner-outfit-preview" aria-label="Live outfit preview">
      <div className="planner-preview-heading">
        <div><p>Your composition</p><h3>See it come together.</h3></div>
        <span role="status">{items.length} {items.length === 1 ? 'piece' : 'pieces'} selected</span>
      </div>
      {items.length ? <div className={`planner-preview-pieces has-${Math.min(items.length, 3)}`}>
        {items.map(item => <figure key={item.id}>
          <div><img src={item.image_url} alt={item.name} /></div>
          <figcaption><span>{item.category}</span><strong>{item.name}</strong></figcaption>
        </figure>)}
      </div> : <p className="planner-preview-empty">Choose a piece below to begin your outfit.</p>}
      <p className="planner-preview-note">Swap a piece below and your preview updates instantly.</p>
    </section>
  );
}
