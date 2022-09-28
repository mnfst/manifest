# Customize

## Concepts

CASE is highly customizable thanks to its multiple variables

It uses 2 styling layers.

- The fist one is the open-source [bulma framework]: https://bulma.io/documentation/customize/concepts/
  that provides essential components and a high quantity of sass variables
- The second layer provides the default style of CASE framework. It includes a style for each component with [modified variables](#case-framework-variables) and [additional component classes](#component-classes).

## How it works

To customise your theme, you will need to:

- [install case](getting-started/install.md)
- update the value of the sass variables

To go further, you can create your own scss files and overwrite our components or create new ones.

### Override

- As we used all the Bulma variables, you can override them to customize your theme
- We provide several specific variables, not used in Bulma than you can customize
- To override any of these variables, just go to `styles.scss` file and set them before importing the main scss file related to case framework.

```css
/* You can add global styles to this file, and also import other style files */
/* insert custom variables here to override existing ones or create new ones */

@import 'styles/variables/your-custome-variables';
@import 'case/styles/main';

/* Import custom style here */
.logo {
  width: 196px;
  max-width: 196px;
}
```

In addition to the color modifiers provided by Bulma, Case includes the following colors:

- link-light
- success-light
- danger-light
- warning-light
- primary-light
- info-light

That means you can add a button, a tag, a panel or any colored component with one of this custom colors using this rule:

```html
<a class="button is-info-light">This is a button</a>
<span class="tag is-info-light">is info light</span>
```

To set your custom variables, create a file `_derived-variables.scss` and add new color variables to the color map.

```css
// First import CASE derived variables
@import 'case/styles/variables/derived-variables';

// 5. Add new color variables to the color map.
$addColors: (
  'orange': (
    #ffdac8,
    // Usually used as main color
    #ee5711,
    // Usually used as secondary color
    #ffdac8,
    $danger
  )
);
$colors: map-merge($custom-colors, $addColors);
// Import then the main scss file
```

You can now use your custom variable

```css
<a class="button is-orange">Orange button</a>
<span class="has-textorange">Text here</span>
```

## CASE framework Variables

#### Avatar

| Variable               | Default value  |
| ---------------------- | -------------- |
| $avatar-diameter       | 36px !default; |
| $avatar-diameter-small | 24px !default; |
| $avatar-diameter-large | 60px !default; |

#### Colors

| Variable            | Default value               |
| ------------------- | --------------------------- |
| $link-alpha10       | rgba($link, 0.1) !default;  |
| $link-alpha07       | rgba($link, 0.07) !default; |
| $link-alpha03       | rgba($link, 0.03) !default; |
| $main-background    | $white-bis !default;        |
| $border-color-input | $link-alpha10 !default;     |
| $icon-color-1       | #ad8875 !default;           |
| $icon-color-2       | #6f627a !default;           |
| $icon-color-3       | #6f627a !default;           |
| $icon-color-4       | #ff8080 !default;           |
| $icon-color-5       | #774e94 !default;           |
| $icon-color-6       | #87655c !default;           |
| $icon-color-7       | #ffc155 !default;           |
| $icon-color-8       | #fa8c43 !default;           |
| $icon-color-9       | #53788d !default;           |
| $icon-color-10      | $danger !default;           |
| $icon-color-11      | $success !default;          |
| $icon-color-12      | $warning !default;          |
| $icon-color-13      | $link !default;             |
| $icon-color-13      | $info !default;             |

#### Dropdown

| Variable                       | Default value   |
| ------------------------------ | --------------- |
| $dropdown-menu-large-min-width | 25rem !default; |

#### Datepicker

| Variable                  | Default value             |
| ------------------------- | ------------------------- |
| $calendar-height          | 268px !default;           |
| $year-height              | 42px !default;            |
| $day-cell-height          | 32px !default;            |
| $day-cell-box-shadow-size | inset 0 0 0 2px !default; |

#### Forms

| Variable                   | Default value         |
| -------------------------- | --------------------- |
| $field-background          | $white-bis !default;  |
| $border                    | $grey-light !default; |
| $checkbox-spacing          | 35px !default;        |
| $checkbox-box-shadow-width | 0 0 0 4px !default;   |
| $select-font-size          | 1.5rem !default;      |

#### Icons

Case use the open source icon library **Feather**.

To display an icon, you can refer to the bulma standard by naming the icons by their name on feather

Example:

| Variable                | Default value |
| ----------------------- | ------------- |
| $icon-arrow-left-circle | '\e905';      |

```
<i class="icon icon-arrow-left-circle"></i>
```

#### Login/logout and password pages

| Variable                       | Default value       |
| ------------------------------ | ------------------- |
| $col-left-width-mobile         | 100% !default;      |
| $col-left-width-tablet         | 66.66667% !default; |
| $col-left-width-desktop        | 40% !default;       |
| $col-left-width-widescreen     | 33.33333% !default; |
| $col-left-max-width-mobile     | unset !default;     |
| $col-left-max-width-tablet     | 100% !default;      |
| $col-left-max-width-desktop    | 424px !default;     |
| $col-left-max-width-widescreen | 482px !default;     |
| $col-left-min-width-mobile     | 86% !default;       |
| $col-left-min-width-tablet     | 43% !default;       |
| $col-left-min-width-desktop    | 360px !default;     |
| $col-left-min-width-widescreen | 382px !default;     |

#### Nav

| Variable                | Default value  |
| ----------------------- | -------------- |
| $aside-width-tablet     | 25% !default;  |
| $aside-width-desktop    | 20% !default;  |
| $aside-width-widescreen | 20% !default;  |
| $aside-width-fullhd     | 12% !default;  |
| $aside-width-collapsed  | 77px !default; |
| $aside-border-width     | 1px !default;  |

#### Notifications

| Variable                | Default value                                      |
| ----------------------- | -------------------------------------------------- |
| $notification-radius    | 4px !default;                                      |
| $notification-padding   | #{$gap / 2} $gap #{$gap / 2} #{$gap / 2} !default; |
| $has-notification-width | 24px !default;                                     |
| $notification-dot-width | 9px !default;                                      |

#### Progress bar

| Variable       | Default value           |
| -------------- | ----------------------- |
| $progress-0    | #e8e8e8 !default;       |
| $bullet-width  | 8px !default;           |
| $bullet-height | $bullet-width !default; |
| $margin-top    | 2px !default;           |
| $margin-right  | 2px !default;           |
| $margin-bottom | 2px !default;           |

```css
$block-spacing: 2rem !default;

$bullet-colors: (
  progress-1: #240986,
  progress-2: #5c1ee8,
  progress-3: #a676f8,
  progress-4: #00c3f9,
  progress-5: #65f2fd,
  progress-6: #73e6d0
);
```

#### Spacing

| Variable       | Default value  |
| -------------- | -------------- |
| $block-spacing | 2rem !default; |

```css
$spacing-values: (
  '0': 0,
  '1': 0.5rem,
  '2': 0.75rem,
  '3': 1rem,
  '4': 1.5rem,
  '5': 2rem,
  '6': 3rem,
  '7': 4rem,
  '8': 5rem,
  '9': 6rem,
  '10': 8rem
) !default;
```

#### Table

| Variable                            | Default value |
| ----------------------------------- | ------------- |
| $border-width-table-row-highlighted | 7px !default; |

#### Tooltip

| Variable                    | Default value     |
| --------------------------- | ----------------- |
| $tooltip-max-width          | 270px !default;   |
| $tooltip-background-color   | $black !default;  |
| $tooltip-background-opacity | 0.95 !default;    |
| $tooltip-radius             | $radius !default; |

#### Type

| Variable        | Default value   |
| --------------- | --------------- |
| $letter-spacing | 0.4px !default; |

## Component classes

> 💬 as a reminder, these classes are added to those of bulma. Please read the [bulma framework documentation](https://bulma.io/documentation/components/) for essential classes

#### Buttons

The button is available with a perfect circle form. Simply append the modifier `is-circle` to apply this specific design.

The circle button is compatible with size and color modifiers.

![currency yield](../assets/images/customize/button-is-circle.png)

```html
<a class="button is-circle is-link" href="/projets/create">
  <i class="icon icon-plus"></i>
</a>
```

> ⚠️ Do not mix up `ìs-circle` modifer with `is-rounded` that is a bulma class allowing to display a button with rounded borders

## Extensions

Case uses the folowwing bulma extensions:

- [bulma tooltip](https://wikiki.github.io/elements/tooltip/)
- [bulma switch](https://wikiki.github.io/form/switch/)
