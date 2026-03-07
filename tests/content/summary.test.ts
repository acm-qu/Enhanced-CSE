import { describe, expect, it } from 'vitest';

import { buildContentSummary } from '@/lib/content/summary';

describe('buildContentSummary', () => {
  it('removes CMS boilerplate from wiki summaries', () => {
    const summary = buildContentSummary({
      title: 'Internship',
      excerptHtml:
        '<p>Main Offerings &amp; Services Internship Print Internship PostedJanuary 26, 2021 UpdatedFebruary 5, 2026 ByAbdulahi Hassen Eligibility and Selection Criteria To be considered for enrollment in CMPE 399/CMPS 399 Practical Training, students must meet certain eligibility criteria established by the college and adhere to specific selection criteria designed to manage enrollment effectively.</p>'
    });

    expect(summary).toContain('students must meet certain eligibility criteria');
    expect(summary).not.toMatch(/Print|Posted|Updated|By Abdulahi/i);
  });

  it('keeps leading department names instead of stripping title-case words', () => {
    const summary = buildContentSummary({
      title: 'Strengthening Industry Collaboration: CSE Hosts IAB Meeting for CS and CE Programs',
      contentHtml:
        '<p>The Computer Science and Engineering (CSE) Department held a joint periodic meeting with the Industrial Advisory Board (IAB) on January 15, 2026 covering both the Computer Science and Computer Engineering programs.</p>'
    });

    expect(summary).toMatch(/^The Computer Science and Engineering \(CSE\) Department held/);
  });

  it('summarizes course inventory pages without dumping raw course tables', () => {
    const summary = buildContentSummary({
      title: 'Electives Offered',
      contentHtml:
        '<h2>Current Electives</h2><table><tr><td>CMPS 312 Mobile Application Development (Prerequisite: CMPS 251)</td><td>CMPS 381 Applied Cryptography (Prerequisite: CMPS 380)</td></tr><tr><td>CMPS 403 Artificial Intelligence (Prerequisite: CMPS 303)</td><td>CMPS 460 Machine Learning (Prerequisites: CMPS 303 and GENG 200)</td></tr></table>'
    });

    expect(summary).toContain('Electives Offered for CS and CE, including');
    expect(summary).toContain('Mobile Application Development');
    expect(summary).toContain('Machine Learning');
    expect(summary).not.toMatch(/^"?CS CE Fall 2025/i);
  });

  it('drops pasted URLs and project metadata when a cleaner paragraph exists', () => {
    const summary = buildContentSummary({
      title: '7. Senior Projects 2019',
      contentHtml:
        '<p>SMUG: A Smart Motion-Based Controller for Smart Home Devices Project ID = S192004</p><p>Smart home systems achieved great popularity in the last decade as they increase comfort and reduce power consumption for users.</p>',
      excerptHtml:
        '<p>Main Senior Projects Past Senior Projects 7. Senior Projects 2019 Print 7. Senior Projects 2019 PostedFebruary 24, 2021 UpdatedDecember 16, 2025 ByAbdulahi Hassen https://www.youtube.com/watch?v=qO7fkse0pa0https://www.youtube.com/watch?v=bed5eoXM5rw Smart home systems achieved great popularity in the last decade as they increase comfort and reduce power consumption for users.</p>'
    });

    expect(summary).toContain('Smart home systems achieved great popularity');
    expect(summary).not.toMatch(/https?:\/\/|Print|Posted|Updated/i);
  });
});