import bcrypt from 'bcrypt';


export async function hashPassword(password: string) {
    const saltRounds = Number(process.env.SALT_ROUNDS);
    const hashed = await bcrypt.hash(password, saltRounds);
    return hashed;
}

export async function verifyPassword(password:string, hashedPassword:string) {
    return await bcrypt.compare(password, hashedPassword);
}

