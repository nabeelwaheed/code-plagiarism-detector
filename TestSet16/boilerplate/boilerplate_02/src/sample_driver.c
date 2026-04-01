#include "menu_framework.h"

#include <stdio.h>

typedef struct {
    int counter;
} DemoContext;

static int action_increment(void *ctx) {
    DemoContext *demo = (DemoContext *)ctx;
    demo->counter += 1;
    printf("Counter is now %d\n", demo->counter);
    return 1;
}

static int action_show(void *ctx) {
    DemoContext *demo = (DemoContext *)ctx;
    printf("Current counter: %d\n", demo->counter);
    return 1;
}

static int action_exit(void *ctx) {
    (void)ctx;
    puts("Exiting.");
    return 0;
}

int main(void) {
    DemoContext context = {0};
    MenuItem items[] = {
        {1, "Increment", action_increment},
        {2, "Show", action_show},
        {0, "Exit", action_exit}
    };
    int keep_running = 1;

    while (keep_running) {
        int choice;
        menu_print_header("Starter Menu");
        menu_print_items(items, 3);
        choice = menu_prompt_choice();
        keep_running = menu_dispatch(items, 3, choice, &context);
    }

    return 0;
}
