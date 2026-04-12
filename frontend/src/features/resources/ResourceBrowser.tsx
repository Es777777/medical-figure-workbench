import type { ElementLibraryItem, LibraryCategoryId } from "../../element-library";

type Props = {
  recommendedLabel: string;
  recommendedItems: ElementLibraryItem[];
  filteredItems: ElementLibraryItem[];
  categories: Array<{ id: LibraryCategoryId | "all"; label: string }>;
  query: string;
  activeCategory: LibraryCategoryId | "all";
  onChangeQuery: (value: string) => void;
  onChangeCategory: (value: LibraryCategoryId | "all") => void;
  onApply: (assetUri: string, label: string) => void;
  actionLabel: string;
  searchPlaceholder: string;
  allLabel: string;
};

export function ResourceBrowser(props: Props) {
  return (
    <div className="resource-browser">
      {props.recommendedItems.length > 0 ? (
        <div className="recommended-strip">
          <strong>{props.recommendedLabel}</strong>
          <div className="library-grid recommended-grid">
            {props.recommendedItems.map((item) => (
              <article className="library-card" key={`recommended-${item.id}`}>
                <img alt={item.label} className="library-preview" src={item.previewUri} />
                <div className="library-meta">
                  <strong>{item.label}</strong>
                  <span>{item.assetUri}</span>
                </div>
                <button className="secondary-button" onClick={() => props.onApply(item.assetUri, item.label)} type="button">
                  {props.actionLabel}
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="library-toolbar">
        <input onChange={(event) => props.onChangeQuery(event.target.value)} placeholder={props.searchPlaceholder} type="text" value={props.query} />
        <div className="library-filters">
          <button className={`secondary-button${props.activeCategory === "all" ? " is-current-decision" : ""}`} onClick={() => props.onChangeCategory("all")} type="button">
            {props.allLabel}
          </button>
          {props.categories.map((category) => (
            <button
              className={`secondary-button${props.activeCategory === category.id ? " is-current-decision" : ""}`}
              key={category.id}
              onClick={() => props.onChangeCategory(category.id)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="library-grid">
        {props.filteredItems.map((item) => (
          <article className="library-card" key={item.id}>
            <img alt={item.label} className="library-preview" src={item.previewUri} />
            <div className="library-meta">
              <strong>{item.label}</strong>
              <span>{item.assetUri}</span>
            </div>
            <button className="secondary-button" onClick={() => props.onApply(item.assetUri, item.label)} type="button">
              {props.actionLabel}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
