import { useEffect } from "react";
import { useLocation } from "react-router";
import { getPageMeta, ROBOTS_INDEX } from "@/lib/page-meta";
import { SITE } from "@/lib/site-config";

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function removeMeta(attribute, key) {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
}

function removeCanonical() {
  document.head.querySelector('link[rel="canonical"]')?.remove();
}

/**
 * Keeps the page title, description, robots directive, canonical URL and
 * social tags in step with the current route. It renders nothing.
 */
export function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = getPageMeta(pathname);
    const indexable = page.robots === ROBOTS_INDEX;

    document.title = page.title;

    upsertMeta("name", "description", page.description);
    upsertMeta("name", "robots", page.robots);

    upsertMeta("property", "og:title", page.title);
    upsertMeta("property", "og:description", page.description);
    upsertMeta("name", "twitter:title", page.title);
    upsertMeta("name", "twitter:description", page.description);

    if (indexable) {
      const url = `${SITE.url}${page.path}`;
      setCanonical(url);
      upsertMeta("property", "og:url", url);
    } else {
      removeCanonical();
      removeMeta("property", "og:url");
    }
  }, [pathname]);

  return null;
}