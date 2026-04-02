#ifndef EXPR_EVAL_H
#define EXPR_EVAL_H

#include <stddef.h>

int infix_to_postfix(const char *expr, char *postfix_out, size_t out_size);
int eval_postfix(const char *postfix, double *result_out);
int eval_expression(const char *expr, double *result_out);

#endif
