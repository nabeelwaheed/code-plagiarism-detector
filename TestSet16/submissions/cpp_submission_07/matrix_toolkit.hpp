#ifndef MATRIX_TOOLKIT_HPP
#define MATRIX_TOOLKIT_HPP

#include <vector>

using Matrix = std::vector<std::vector<double>>;

Matrix readMatrix(int rows, int cols);
Matrix add(const Matrix &a, const Matrix &b);
Matrix multiply(const Matrix &a, const Matrix &b);
Matrix transpose(const Matrix &m);
double trace(const Matrix &m);
void printMatrix(const Matrix &m);

#endif
