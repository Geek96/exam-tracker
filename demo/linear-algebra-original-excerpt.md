# Linear Algebra - Original PDF Excerpt

Source: OCR excerpt generated from the local demo PDF, pages 17-22 of the bundled scan. OCR may contain recognition errors; it is intentionally kept as a demo material so users can compare AI answers across multiple selected files.

## OCR Page 1

Sec. 1.1 Introduction 3
(a1, tae)
(a1, a2) eet %, (ax + Ba, a2 + ba) te '
Cay fh (a1, a2}
at 1
x ‘3 (a1 +b1,b2) aan ,
(61,52) ' ‘
7 1
P a tay
(a) (b)
Figure 1.2
or contracted. This operation, called scalar multiplication, consists of mul-
tiplying the vector by a real number, If the vector x is represented by an
arrow, then for any nonzero real number t, the vector tz is represented by an
arrow in the same direction if f > 0 and in the opposite direction if t < 0.
The length of the arrow é2 is |é| times the length of the arrow x. Two nonzero
vectors x and y are called parallel if y = tz for some nonzero real number t.
(Thus nonzero vectors having the same or opposite directions are parallel.)

To describe scalar multiplication algebraically, again introduce a coordi-
nate system into a plane containing the vector 2 so that x emanates from the
origin. If the endpoint of « has coordinates (a1,a2), then the coordinates of
the endpoint of ta are easily seen to be (ta;,ta2). (See Figure 1.2(b).)

The algebraic descriptions of vector addition and scalar multiplication for
vectors in a plane yield the following properties:

1. For all vectors x and y, e+ y=y+z.

2. For all vectors x, y, and z, (2 +y)+z2=2+ (y+z).

3. There exists a vector denoted 0 such that «+ 0 = x for each vector x.

4, For each vector z, there is a vector y such that ¢ + y= 0.

5. For each vector z, la = x.

6. For each pair of real numbers a and 6 and each vector 2, (ab)a = a(bz).

7. For each real number a and each pair of vectors z and y, a(z + y) =
az + ay.

8. For each pair of real numbers a and 6 and each vector z, (a + d)r =
ax + bz.

Arguments similar to the preceding ones show that these eight properties,
as well as the geometric interpretations of vector addition and scalar multipli-
cation, are true also for vectors acting in space rather than in a plane. These
results can be used to write equations of lines and planes in space.

## OCR Page 2

4 Chap. 1 Vector Spaces
Consider first the equation of a line in space that passes through two
distinct points A and B. Let O denote the origin of a coordinate system in
space, and let u and v denote the vectors that begin at O and end at A and
B, respectively. If w denotes the vector beginning at A and ending at B, then
“tail-to-head” addition shows that u+w =v, and hence w = v—u, where —u
denotes the vector (—1)u. (See Figure 1.3, in which the quadrilateral OABC
is a parallelogram.) Since a scalar multiple of w is parallel to w but possibly
of a different length than w, any point on the line joining A and B may be
obtained as the endpoint of a vector that begins at A and has the form tw
for some real number ¢. Conversely, the endpoint of every vector of the form
tw that begins at A lies on the line joining A and B. Thus an equation of the
line through A and Bis g=u+tw =utt(y —wu), where ¢ is a real number
and x denotes an arbitrary point on the line. Notice also that the endpoint
C of the vector v— u in Figure 1.3 has coordinates equal to the difference of
the coordinates of B and A.
uw a
y a3
v “7
Pru r*ye
Figure 1.3
Example 1
Let A and B be points having coordinates (—2, 0,1) and (4, 5, 3), respectively.
The endpoint C of the vector emanating from the origin and having the same
direction as the vector beginning at A and terminating at B has coordinates
(4,5,3) - (-2,0,1) = (6,5, 2). Hence the equation of the line through A and
x = (—2,0,1) +£(6,5,2).

Now let A, B, and C denote any three noncollinear points in space. These
points determine a unique plane, and its equation can be found by use of our
previous observations about vectors. Let u and v denote vectors beginning at
A and ending at B and C, respectively. Observe that any point in the plane
containing A, B, and C is the endpoint §$ of a vector x beginning at A and
having the form su+¢v for some real numbers s and t. The endpoint of su is
the point of intersection of the line through A and B with the line through S$
parallel to the line through A and C. (See Figure 1.4.) A similar procedure

## OCR Page 3

Sec. 1.1 Introduction 5
A te 7 Cc
Figure 1.4
locates the endpoint of tv. Moreover, for any real numbers ¢ and t, the vector
su + tv lies in the plane containing A, B, and C. It follows that an equation
of the plane containing A, B, and C is
zw=Atsutie,
where s and ¢ are arbitrary real numbers and x denotes an arbitrary point in
the plane,
Example 2
Let A, B, and C be the points having coordinates (1,0,2), (-3, -2, 4), and
(1,8, —5), respectively. The endpoint of the vector emanating from the origin
and having the same length and direction as the vector beginning at A and
terminating at B is
(-3, -2, 4) — (1, 0, 2) = (—4, -2, 2).
Similarly, the endpeint of a vector emanating from the origin and having the
same length and direction as the vector beginning at A and terminating at C
is (1,8, -5)—(1, 0,2) = (0,8,-7). Hence the equation of the plane containing
the three given points is
x = (1,0,2) + s(—4,-2,2)+4(0,8,-7). @

Any mathematical structure possessing the eight properties on page 3 is
called a vector space. In the next section we formally define a vector space
and consider many examples of vector spaces other than the ones mentioned
above.

EXERCISES
1. Determine whether the vectors emanating from the origin and termi-
nating at the following pairs of points are parallel.

## OCR Page 4

6 Chap. 1 Vector Spaces

(a) (3,1,2) and (6, 4,2)
(b) (—3,1,7) and (9, -3, -21)
(c) (5,-6,7) and (—5,6,—-7)
(d) (2,0, —5) and (5,0, —2)

2. Find the equations of the lines through the following pairs of points in
space.
(a) (8,—2,4) and (—5,7, 1)
(b) (2,4,0) and (—3, -6, 0)
(c) (3,7, 2) and (3,7,—8)
(d) (—2,-1,5) and (3,9,7)

3. Find the equations of the planes containing the following points in space.
(a) (2,-5,-1), (0,4,6), and (-3,7, 1)
(b) (3,-6,7), (-2,0,—4), and (5, -9, -2)
(c) (—8,2,0), (1,3,0), and (6, —5, 0)
(d) (1,1,1), (5,5,5), and (—6, 4, 2)

4. What are the coordinates of the vector @ in the Euclidean plane that
satisfies property 3 on page 3? Justify your answer.

[BJ Prove that if the vector « emanates from the origin of the Buclidean
plane and terminates at the point with coordinates (a;,a2), then the
vector tz that emanates from the origin terminates at the point with
coordinates (tay, ta2). Visit goo.gl/eYTxuU for a solution.

6. Show that the midpoint of the line segment joining the points (a, b) and

(c,d) is ((a + c)/2, (b+ d)/2).

7. Prove that the diagonals of a parallelogram bisect each other.
1.2. VECTOR SPACES
In Section 1.1, we saw that with the natural definitions of vector addition and
scalar multiplication, the vectors in a plane satisfy the eight properties listed
on page 3. Many other familiar algebraic systems also permit definitions of
addition and scalar multiplication that satisfy the same eight properties. In
this section, we introduce some of these systems, but first we formally define
this type of algebraic structure,

Definitions. A vector space (or linear space) V over a field? F
consists of a set on which two operations (called addition and scalar mul-
tiplication, respectively) are defined so that for each pair of elements x, y,

*Fields are discussed in Appendix C.

## OCR Page 5

Sec. 1.2 Vector Spaces 7
in V there is a unique element «+ y in V, and for each element a in F and
each element z in V there is a unique element az in V, such that the following
conditions hold.

(VS 1) For all z, y in V, 2+ y= y+ x (commutativity of addition).

(VS 2) For all x, y, z in V, (c+ y) +2 = 24+ (y+ 2) (associativity of

addition).

(VS 3) There exists an element in V denoted by 0 such that z+ 0 = x for

each z in V.

(V5 4) For each element x in V there exists an element y in V such that

rt+y=0.

(VS 5) For each element x in V, 12 = x.

(VS 6) For each pair of elements a, b in F and each element a in V,

(ab)x = a(bz).
(VS 7) For each element a in F and each pair of elements x, y in V,
a(z + y) = ox + ay.
(VS 8) For each pair of elements a, b in F and each element x in V,
(a + b)z = ox + be.
The elements x + y and az are called the sum of x and y and the product
of a and x, respectively.

The elements of the field F are called scalars and the elements of the
vector space V are called vectors. The reader should not confuse this use of
the word “vector” with the physical entity discussed in Section 1.1: the word
“vector” is now being used to describe any element of a vector space.

A vector space is frequently discussed in the text without explicitly men-
tioning its field of scalars. The reader is cautioned to remember, however,
that every vector space is regarded as a vector space over a given field, which
is denoted by F, Occasionally we restrict our attention to the fields of real
and complex numbers, which are denoted R and C, respectively. Unless oth-
erwise noted, we assume that fields used in the examples and exercises of this
book have characteristic zero (see page 549).

Observe that (VS 2) permits us to define the addition of any finite number
of vectors unambiguously (without the use of parentheses).

In the remainder of this section we introduce several important examples
of vector spaces that are studied throughout this text. Observe that in de
scribing a vector space, it is necessary to specify not only the vectors but also

## OCR Page 6

8 Chap. 1 Vector Spaces
the operations of addition and scalar multiplication. The reader should check
that each of these examples satisfies conditions (VS1) through (V58).

An object of the form (a1,a2,...,@,), where the entries a), @2,...,@, are
elements of a field F, is called an n-tuple with entries from F. The elements
@1,02,...,4, are called the entries or components of the n-tuple. Two
n-tuples (01,42,...,@n) and (b1,b2,...,,) with entries from a field FP are
called equal if a; = 6; for i= 1,2,...,2.

Example 1

The set of all n-tuples with entries from a field F is denoted by F". This setisa
vector space over F with the operations of coordinatewise addition and scalar
multiplication; that is, if u = (1,@2,...,@n) € F™, v = (by, be... ,bn) € F*,
and ¢ é€ F, then

utes=(ai+b1,02 +b2,...,¢n+6n) and cu= (cai, cap,..., can).
Thus R? is a vector space over R. In this vector space,

(3,-2,0) + (-1,1,4) = (2,-1,4}) and —5(1,-2,0) = (—5, 10,0).
Similarly, C? is a vector space over C. In this vector space,
(1+ 4,2) + (2— 34,44) =(3-21,244%) and é(1+4,2) = (-1+434,2%).

Vectors in F" may be written as column vectors

rather than as row vectors (a1, @2,...,@,). Since a 1-tuple whose only entry
is from F can be regarded as an element of F’, we usually write F rather than
F* for the vector space of 1-tuples with entry from FP. @

An mx n matrix with entries from a field F is a rectangular array of the

form

41 G12 ‘" Gin

aq, 22, + ** an

: : : '

mi m2 ‘** Omn,
where each entry aj; (1 < i < m, 1 <j <n) is an element of F. We
call the entries a,; with i = j the diagonal entries of the matrix. The
entries aj), 4j2,...,@in compose the ¢th row of the matrix, and the entries
